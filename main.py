import os
import json
from datetime import datetime
from typing import Optional, List
import io

from fastapi import FastAPI, Request, Depends, Form, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select, or_, delete
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import pandas as pd
import uvicorn

from models import (
    engine, User, Package, Variable, Spreadsheet, FrameworkVersion, 
    Project, ProjectVersion, UserRole, FrameworkType, ProjectStatus,
    create_db_and_tables
)

load_dotenv()

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "supersecret"))

templates = Jinja2Templates(directory="templates")

# Google SSO Setup
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
DEV_MODE = not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)

oauth = OAuth()
if not DEV_MODE:
    oauth.register(
        name='google',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

ALLOWED_DOMAINS = ["aktienow.com", "coaktion.com"]

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    seed_db()

def seed_db():
    with Session(engine) as session:
        if not session.exec(select(Package)).first():
            pkgs = [
                Package(name="Pacote Start", hours=40.0, scope_included="Configuração inicial e treinamento básico", category="Implantação"),
                Package(name="Pacote Growth", hours=80.0, scope_included="Configuração avançada, integrações e treinamento", category="Implantação"),
                Package(name="Suporte N1", hours=10.0, scope_included="Atendimento via ticket, SLA 24h", category="Suporte"),
            ]
            session.add_all(pkgs)
            
        if not session.exec(select(Variable)).first():
            vars = [
                Variable(key="valor_hora_tecnica", value="250.00", category="Financeiro"),
                Variable(key="dias_validade_proposta", value="15", category="Comercial"),
            ]
            session.add_all(vars)
        session.commit()

def get_session():
    with Session(engine) as session:
        yield session

def get_current_user(request: Request, session: Session = None):
    user_info = request.session.get('user')
    if not user_info:
        return None
    
    if session:
        # Try to fetch from DB
        db_user = session.exec(select(User).where(User.email == user_info['email'])).first()
        if db_user:
            return db_user
            
        # If not found but in DEV_MODE, create it automatically
        if DEV_MODE:
            new_user = User(
                email=user_info['email'],
                name=user_info.get('name', 'Dev User'),
                picture=user_info.get('picture', ''),
                role=UserRole.SC if user_info['email'] == "admin@dev.local" else UserRole.USER
            )
            session.add(new_user)
            session.commit()
            session.refresh(new_user)
            return new_user
        
    # Fallback if no session provided (shouldn't happen in routes with dependency)
    return User(**user_info, role=UserRole.USER)

def check_domain(email: str):
    domain = email.split('@')[-1]
    return domain in ALLOWED_DOMAINS

# Routes
@app.get("/", response_class=HTMLResponse)
async def index(request: Request, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    return templates.TemplateResponse("index.html", {"request": request, "user": user, "dev_mode": DEV_MODE})

@app.get("/login")
async def login(request: Request):
    if DEV_MODE:
        # Show a simple form to login as any user
        return HTMLResponse("""
        <html>
            <head><title>Dev Login</title></head>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <div style="border:1px solid #ccc; padding:2rem; border-radius:8px; width:300px;">
                    <h2>Dev Login</h2>
                    <form action="/dev-login" method="post">
                        <label>Email:</label><br>
                        <input type="email" name="email" value="admin@dev.local" required style="width:100%; padding:8px; margin-bottom:10px;"><br>
                        <label>Nome:</label><br>
                        <input type="text" name="name" value="Dev Admin" required style="width:100%; padding:8px; margin-bottom:10px;"><br>
                        <button type="submit" style="background:#4CAF50; color:white; padding:10px; border:none; width:100%; cursor:pointer;">Login</button>
                    </form>
                    <hr>
                    <p style="font-size:0.8em; color:#666;">
                        Use <b>admin@dev.local</b> para Admin/SC.<br>
                        Qualquer outro email será criado como Usuário Comum.
                    </p>
                </div>
            </body>
        </html>
        """)
    
    redirect_uri = request.url_for('auth')
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@app.post("/dev-login")
async def dev_login(request: Request, email: str = Form(...), name: str = Form(...)):
    if not DEV_MODE:
        return RedirectResponse(url="/")
        
    request.session['user'] = {"name": name, "email": email, "picture": ""}
    return RedirectResponse(url='/', status_code=status.HTTP_303_SEE_OTHER)

@app.get("/auth")
async def auth(request: Request, session: Session = Depends(get_session)):
    if DEV_MODE:
         return RedirectResponse(url='/')
         
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    
    if user_info:
        if not check_domain(user_info['email']):
             # In a real app, show an error page
             return HTMLResponse("Domain not allowed. Please use @aktienow.com or @coaktion.com", status_code=403)

        # Upsert User
        db_user = session.exec(select(User).where(User.email == user_info['email'])).first()
        if not db_user:
            db_user = User(
                email=user_info['email'],
                name=user_info.get('name'),
                picture=user_info.get('picture'),
                role=UserRole.USER # Default role
            )
            session.add(db_user)
            session.commit()
            session.refresh(db_user)
        
        request.session['user'] = user_info
        
    return RedirectResponse(url='/')

@app.get("/logout")
async def logout(request: Request):
    request.session.pop('user', None)
    return RedirectResponse(url='/')

# --- ADMIN AREA ---
@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    if not user or user.role not in [UserRole.SC, UserRole.DEV, UserRole.CONSULTING]:
        return RedirectResponse(url="/") # Or 403
    
    packages = session.exec(select(Package).where(Package.is_active == True)).all()
    variables = session.exec(select(Variable).where(Variable.is_active == True)).all()
    
    # Versions logic - simplified for now, fetching all types
    versions = session.exec(select(FrameworkVersion).order_by(FrameworkVersion.created_at.desc())).all()
    
    users = session.exec(select(User)).all()

    return templates.TemplateResponse("admin.html", {
        "request": request, 
        "user": user, 
        "packages": packages, 
        "variables": variables,
        "versions": versions,
        "users": users,
        "dev_mode": DEV_MODE
    })

@app.post("/admin/package")
async def add_package(
    name: str = Form(...), 
    hours: float = Form(...), 
    scope_included: str = Form(""), 
    scope_excluded: str = Form(""), 
    category: str = Form(None), 
    skill: str = Form("Implantação"),
    link: str = Form(None),
    session: Session = Depends(get_session)
):
    package = Package(
        name=name, 
        hours=hours, 
        scope_included=scope_included, 
        scope_excluded=scope_excluded, 
        category=category,
        skill=skill,
        link=link
    )
    session.add(package)
    session.commit()
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/admin/package/delete/{pkg_id}")
async def delete_package(pkg_id: int, session: Session = Depends(get_session)):
    pkg = session.get(Package, pkg_id)
    if pkg:
        pkg.is_active = False
        session.add(pkg)
        session.commit()
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/admin/variable")
async def add_variable(
    key: str = Form(...), 
    value: str = Form(...), 
    category: str = Form(None), 
    session: Session = Depends(get_session)
):
    # Check if exists and is active
    existing = session.exec(select(Variable).where(Variable.key == key)).first()
    if existing:
        existing.value = value
        existing.category = category
        existing.is_active = True # Reactivate if was deleted
        existing.updated_at = datetime.utcnow()
    else:
        var = Variable(key=key, value=value, category=category)
        session.add(var)
    session.commit()
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/admin/variable/delete/{var_id}")
async def delete_variable(var_id: int, session: Session = Depends(get_session)):
    var = session.get(Variable, var_id)
    if var:
        var.is_active = False
        session.commit()
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/admin/snapshot")
async def create_snapshot(
    version_name: str = Form(...),
    type: str = Form(FrameworkType.SC_AE),
    session: Session = Depends(get_session),
    request: Request = None
):
    user = get_current_user(request, session)
    packages = session.exec(select(Package).where(Package.is_active == True)).all()
    variables = session.exec(select(Variable).where(Variable.is_active == True)).all()
    
    data = {
        "packages": [p.model_dump() for p in packages],
        "variables": [v.model_dump() for v in variables]
    }
    
    version = FrameworkVersion(
        version_name=version_name,
        type=type,
        data=json.dumps(data, default=str),
        created_by=user.id if user.id else None
    )
    session.add(version)
    session.commit()
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/admin/rollback/{version_id}")
async def rollback(version_id: int, session: Session = Depends(get_session)):
    print(f"Rollback initiated for version {version_id}")
    version = session.get(FrameworkVersion, version_id)
    if not version:
        print("Version not found")
        raise HTTPException(status_code=404, detail="Version not found")
    
    try:
        data = json.loads(version.data)
        print(f"Restoring data: {len(data.get('packages', []))} packages, {len(data.get('variables', []))} variables")
        
        # Delete existing
        session.exec(delete(Package)) 
        session.exec(delete(Variable))
        session.commit() # Commit deletion first to be safe
        
        # Restore Packages
        for p_data in data["packages"]:
            # Remove datetime fields that might be strings
            if 'created_at' in p_data: del p_data['created_at']
            if 'updated_at' in p_data: del p_data['updated_at']
            
            # Ensure fields match model
            pkg = Package(**{k: v for k, v in p_data.items() if k in Package.__fields__})
            session.add(pkg)
        
        # Restore Variables
        for v_data in data["variables"]:
            if 'created_at' in v_data: del v_data['created_at']
            if 'updated_at' in v_data: del v_data['updated_at']
            
            var = Variable(**{k: v for k, v in v_data.items() if k in Variable.__fields__})
            session.add(var)
            
        session.commit()
        print("Rollback successful")
    except Exception as e:
        print(f"Rollback error: {e}")
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/admin/user/role")
async def update_user_role(user_id: int = Form(...), role: str = Form(...), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if user:
        user.role = role
        session.add(user)
        session.commit()
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)


# --- SC AREA (PROJECTS) ---
@app.get("/sc", response_class=HTMLResponse)
async def sc_dashboard(request: Request, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    if not user: return RedirectResponse(url="/login")
    
    # Fetch projects: owned by user OR public (if we implement public view logic properly)
    # For now, show all for SC, or own for others.
    if user.role == UserRole.SC:
        projects = session.exec(select(Project).order_by(Project.updated_at.desc())).all()
    else:
        projects = session.exec(select(Project).where(or_(Project.owner_id == user.id, Project.is_private == False)).order_by(Project.updated_at.desc())).all()
        
    return templates.TemplateResponse("sc_dashboard.html", {
        "request": request, 
        "user": user, 
        "projects": projects,
        "dev_mode": DEV_MODE
    })

@app.post("/sc/project")
async def create_project(name: str = Form(...), is_private: bool = Form(False), session: Session = Depends(get_session), request: Request = None):
    user = get_current_user(request, session)
    if not user: return RedirectResponse(url="/login")
    
    project = Project(name=name, owner_id=user.id, is_private=is_private)
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return RedirectResponse(url=f"/sc/project/{project.id}", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/sc/project/{project_id}/delete")
async def delete_project(project_id: int, session: Session = Depends(get_session), request: Request = None):
    user = get_current_user(request, session)
    if not user: return RedirectResponse(url="/login")
    
    project = session.get(Project, project_id)
    if not project:
        print(f"DEBUG: Project {project_id} not found in DB")
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check permissions (Owner or SC Admin)
    if project.owner_id != user.id and user.role != UserRole.SC:
         print(f"DEBUG: Permission denied for user {user.email} on project {project_id}")
         raise HTTPException(status_code=403, detail="Acesso negado")
    
    print(f"DEBUG: Deleting project {project_id} and its versions")
    # Delete all associated versions first (optional but good practice for SQLite)
    session.exec(delete(ProjectVersion).where(ProjectVersion.project_id == project_id))
    session.delete(project)
    session.commit()
    
    return RedirectResponse(url="/sc", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/sc/project/{project_id}/version/{version_id}/delete")
async def delete_project_version(project_id: int, version_id: int, session: Session = Depends(get_session), request: Request = None):
    user = get_current_user(request, session)
    if not user: return RedirectResponse(url="/login")
    
    version = session.get(ProjectVersion, version_id)
    if not version or version.project_id != project_id:
        raise HTTPException(status_code=404, detail="Versão não encontrada")
        
    # Check permissions (Only SC Admin can delete versions)
    if user.role != UserRole.SC:
         raise HTTPException(status_code=403, detail="Acesso negado: Apenas administradores podem excluir versões")
    
    session.delete(version)
    session.commit()
    
    return RedirectResponse(url=f"/sc/project/{project_id}", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/sc/project/{project_id}", response_class=HTMLResponse)
async def project_editor(project_id: int, request: Request, version_id: Optional[int] = None, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    if not user: return RedirectResponse(url="/login")
    
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check permissions (Owner or Admin or Public)
    if project.is_private and project.owner_id != user.id and user.role != UserRole.SC:
         return HTMLResponse("Access Denied", status_code=403)
         
    # Fetch variables and packages to populate the "Spreadsheet"
    variables = session.exec(select(Variable).where(Variable.is_active == True)).all()
    packages = session.exec(select(Package).where(Package.is_active == True)).all()
    
    # Organize packages by category
    categories = sorted(list(set(p.category for p in packages if p.category)))
    packages_by_category = {cat: [p for p in packages if p.category == cat] for cat in categories}
    
    # Fetch all versions for dropdown
    all_versions = session.exec(select(ProjectVersion).where(ProjectVersion.project_id == project_id).order_by(ProjectVersion.created_at.desc())).all()
    
    # Determine current version to display
    current_version = None
    if version_id:
        current_version = session.get(ProjectVersion, version_id)
    elif all_versions:
        current_version = all_versions[0] # Latest
        
    current_data = json.loads(current_version.data) if current_version and current_version.data else {}
    
    return templates.TemplateResponse("project_editor.html", {
        "request": request,
        "user": user,
        "project": project,
        "variables": variables,
        "packages_by_category": packages_by_category,
        "categories": categories,
        "current_version": current_version,
        "all_versions": all_versions,
        "current_data": current_data,
        "dev_mode": DEV_MODE
    })

@app.post("/sc/project/{project_id}/save")
async def save_project_version(
    project_id: int, 
    request: Request,
    version_name: str = Form(...),
    technical_scope_link: str = Form(""),
    gp_percent: float = Form(25.0),
    discovery_percent: float = Form(0.0),
    validation_percent: float = Form(0.0),
    gp_override: Optional[str] = Form(None),
    discovery_override: Optional[str] = Form(None),
    validation_override: Optional[str] = Form(None),
    action: str = Form("save"),
    current_version_id: Optional[int] = Form(None),
    session: Session = Depends(get_session)
):
    user = get_current_user(request, session)
    if not user: return RedirectResponse(url="/login")
    
    # Helper to parse optional float
    def parse_opt_float(val):
        if not val: return None
        try:
            return float(val)
        except ValueError:
            return None

    gp_override_val = parse_opt_float(gp_override)
    discovery_override_val = parse_opt_float(discovery_override)
    validation_override_val = parse_opt_float(validation_override)

    form_data = await request.form()
    
    # Extract estimate items from form_data
    # Expecting format: item_{package_id}_qty, custom_{index}_name, custom_{index}_hours, etc.
    
    data_dict = {}
    for key, value in form_data.items():
        if key.startswith("item_") or key.startswith("custom_") or key.startswith("check_area_"):
            data_dict[key] = value
            
    json_data = json.dumps(data_dict)
    
    if action == "save" and current_version_id:
        # Update existing version
        version = session.get(ProjectVersion, current_version_id)
        if version:
            version.version_name = version_name
            version.data = json_data
            version.technical_scope_link = technical_scope_link
            version.gp_percent = gp_percent
            version.discovery_percent = discovery_percent
            version.validation_percent = validation_percent
            version.gp_override = gp_override_val
            version.discovery_override = discovery_override_val
            version.validation_override = validation_override_val
            
            session.add(version)
            session.commit()
            return RedirectResponse(url=f"/sc/project/{project_id}?version_id={version.id}", status_code=status.HTTP_303_SEE_OTHER)

    project_version = ProjectVersion(
        project_id=project_id,
        version_name=version_name,
        data=json_data,
        technical_scope_link=technical_scope_link,
        gp_percent=gp_percent,
        discovery_percent=discovery_percent,
        validation_percent=validation_percent,
        gp_override=gp_override_val,
        discovery_override=discovery_override_val,
        validation_override=validation_override_val,
        created_by=user.id
    )
    
    session.add(project_version)
    session.commit()
    session.refresh(project_version)
    
    return RedirectResponse(url=f"/sc/project/{project_id}?version_id={project_version.id}", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/sc/project/{project_id}/export")
async def export_project(
    project_id: int,
    request: Request,
    session: Session = Depends(get_session)
):
    user = get_current_user(request, session)
    if not user:
        return RedirectResponse(url="/login")
    
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    # Check permissions
    if project.is_private and project.owner_id != user.id and user.role not in [UserRole.SC]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Get latest version
    version = session.exec(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == project_id)
        .order_by(ProjectVersion.created_at.desc())
    ).first()

    if not version:
        return RedirectResponse(url=f"/sc/project/{project_id}")

    data = json.loads(version.data)
    
    # Build Export Data
    export_rows = []
    
    # Standard Packages
    packages = session.exec(select(Package)).all()
    for pkg in packages:
        # Check qty in data (support both new _qty suffix and old format)
        qty_key = f"item_{pkg.id}_qty"
        qty_val = data.get(qty_key)
        
        if not qty_val:
             qty_key_old = f"item_{pkg.id}"
             qty_val = data.get(qty_key_old)
             
        if qty_val:
            try:
                qty = float(qty_val)
                if qty > 0:
                    # Check for override
                    override_check_key = f"item_override_check_{pkg.id}"
                    override_val_key = f"item_override_val_{pkg.id}"
                    
                    total = qty * pkg.hours
                    is_override = False
                    
                    if data.get(override_check_key) == 'on':
                        try:
                            override_val = float(data.get(override_val_key, 0))
                            total = override_val
                            is_override = True
                        except ValueError:
                            pass
                            
                    export_rows.append({
                        "Categoria": pkg.category,
                        "Item": pkg.name,
                        "Escopo": pkg.scope_included,
                        "Horas Unit.": pkg.hours if not is_override else "-",
                        "Qtd": qty,
                        "Total Horas": total,
                        "Obs": "Manual Override" if is_override else ""
                    })
            except ValueError:
                pass
            
    # Custom Items
    # Loop through keys to find custom items
    custom_indices = set()
    for key in data.keys():
        if key.startswith("custom_") and key.endswith("_name"):
            parts = key.split("_")
            # Format: custom_{idx}_name
            if len(parts) >= 3 and parts[1].isdigit():
                custom_indices.add(parts[1])
    
    for idx in custom_indices:
        name = data.get(f"custom_{idx}_name", "Item Personalizado")
        try:
            hours = float(data.get(f"custom_{idx}_hours", 0))
            qty = float(data.get(f"custom_{idx}_qty", 0))
        except ValueError:
            hours = 0.0
            qty = 0.0
            
        if qty > 0:
            export_rows.append({
                "Categoria": "Personalizado",
                "Item": name,
                "Escopo": "-",
                "Horas Unit.": hours,
                "Qtd": qty,
                "Total Horas": qty * hours,
                "Obs": ""
            })

    # Custom Packages (per category)
    custom_pkg_keys = set()
    for key in data.keys():
        if key.startswith("custom_pkg_") and key.endswith("_name"):
            parts = key.split("_")
            if len(parts) >= 5:
                idx = parts[-2]
                cat = "_".join(parts[2:-2])
                custom_pkg_keys.add((cat, idx))
    
    for cat, idx in custom_pkg_keys:
        prefix = f"custom_pkg_{cat}_{idx}"
        name = data.get(f"{prefix}_name")
        try:
            hours = float(data.get(f"{prefix}_hours", 0))
            qty = float(data.get(f"{prefix}_qty", 0))
        except ValueError:
            hours = 0.0
            qty = 0.0
            
        if qty > 0 and name:
            scope_in = data.get(f"{prefix}_scope_in", "")
            scope_out = data.get(f"{prefix}_scope_out", "")
            scope_text = scope_in
            if scope_out:
                scope_text += f"\nExcluso: {scope_out}"
                
            export_rows.append({
                "Categoria": cat,
                "Item": name,
                "Escopo": scope_text,
                "Horas Unit.": hours,
                "Qtd": qty,
                "Total Horas": qty * hours,
                "Obs": "Personalizado"
            })

    df = pd.DataFrame(export_rows)
    
    # Calculate Totals from DataFrame if possible, or recalculate
    subtotal = df["Total Horas"].sum() if not df.empty else 0
    
    # GP
    gp_percent = version.gp_percent
    gp_value = version.gp_override if version.gp_override is not None else subtotal * (gp_percent / 100)
    
    # Discovery/Validation
    disc_percent = version.discovery_percent
    valid_percent = version.validation_percent
    
    disc_val_total = (version.discovery_override if version.discovery_override is not None else subtotal * (disc_percent / 100)) + \
                     (version.validation_override if version.validation_override is not None else subtotal * (valid_percent / 100))
    
    grand_total = subtotal + gp_value + disc_val_total

    # Create Summary DataFrame
    summary_data = [
        {"Item": "Subtotal Técnico", "Total Horas": subtotal},
        {"Item": f"GP ({gp_percent}%)", "Total Horas": gp_value},
        {"Item": f"Discovery/Validação ({disc_percent+valid_percent}%)", "Total Horas": disc_val_total},
        {"Item": "TOTAL GERAL", "Total Horas": grand_total}
    ]
    df_summary = pd.DataFrame(summary_data)

    # Write to Excel
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if not df.empty:
            df.to_excel(writer, sheet_name="Detalhamento", index=False)
        else:
            pd.DataFrame(["Sem itens"]).to_excel(writer, sheet_name="Detalhamento", index=False)
            
        df_summary.to_excel(writer, sheet_name="Resumo", index=False)
    
    output.seek(0)
    
    filename = f"Estimativa_{project.name}_{version.version_name}.xlsx".replace(" ", "_")
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


# --- AE AREA ---
@app.get("/ae", response_class=HTMLResponse)
async def ae_page(request: Request, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    if not user: return RedirectResponse(url="/login")
    
    packages = session.exec(select(Package).where(Package.is_active == True)).all()
    categories = sorted(list(set(p.category for p in packages if p.category)))
    
    return templates.TemplateResponse("ae.html", {
        "request": request, 
        "user": user, 
        "packages": packages, 
        "categories": categories,
        "suggestion": "Selecione opções...",
        "dev_mode": DEV_MODE
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000)
