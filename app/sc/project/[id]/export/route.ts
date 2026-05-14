import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = parseInt(params.id);
  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("version_id");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { owner: true }
  });

  if (!project) return new NextResponse("Project not found", { status: 404 });

  const version = versionId 
    ? await prisma.projectVersion.findUnique({ where: { id: parseInt(versionId) } })
    : await prisma.projectVersion.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } });

  if (!version) return new NextResponse("Version not found", { status: 404 });

  const data = JSON.parse(version.data);
  
  // Create a simple CSV content
  let csv = "Categoria,Pacote,Skill,Horas,Qtd,Total\n";
  
  // This is a simplified export. In a real scenario, you'd process 
  // all items from 'data' and 'packages' like in the editor.
  csv += `Resumo de Projeto: ${project.name}\n`;
  csv += `Versao: ${version.versionName}\n`;
  csv += `Total Geral: ${version.gpOverride || 'N/A'}H\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="projeto-${projectId}.csv"`
    }
  });
}
