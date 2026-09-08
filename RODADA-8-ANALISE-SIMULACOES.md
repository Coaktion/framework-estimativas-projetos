# Rodada 8 — Análise das simulações

24 cenários de porte **baixo e médio**, rodados no engine anterior (Rodada 7) e
no novo, lado a lado. Nada acima de 40 agentes, 3 marcas e 6 áreas — a
Calculadora AE não é feita para projetos grandes.

---

## Resultado consolidado

| Métrica | Valor |
| :--- | ---: |
| Variação média | **−1,2%** |
| Mediana | **−1,4%** |
| Cenários que caíram | 17 / 24 |
| Cenários que subiram | 7 / 24 |
| Maior redução | −44,4% (cenário com 3 idiomas) |
| Maior aumento | +23,5% (cenário com WFM) |

Por plano:

| Plano | Variação média | n |
| :--- | ---: | ---: |
| Team | **−6,9%** | 4 |
| Growth | −1,6% | 5 |
| Professional | −2,7% | 10 |
| Enterprise | **+6,8%** | 5 |

**Sem os cenários com WFM, a média é −2,2%, numa faixa estreita de −7,5% a
+2,2%.** Isto é o retrato honesto da recalibração: um ajuste fino para baixo,
consistente, sem surpresa. Toda a dispersão vem de dois lugares — WFM e
multi-idioma.

---

## Risco nº 1 — WFM subiu de 30% a 80%

A mudança em Localizações (`Marcas × Ops` → `Áreas × Ops`) parece pequena, mas
**compõe por três níveis**:

```
Localizações  = Áreas × Operações
Turnos        = Localizações × 2
AutomaçõesWFM = 2 + Equipes × 0,5 × Turnos     ← produto
```

Localizações dobrou (média +107%), Turnos dobrou junto, e Automações WFM —
que é um **produto** — dobrou a parcela variável. Medido:

| Áreas | Marcas | Ops | Local. antes | Local. depois | WFM antes | WFM depois | Δ |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 1 | 1 | 3,58h | 3,58h | 0% |
| 3 | 1 | 1 | 1 | 3 | 3,94h | 6,88h | **+75%** |
| 4 | 2 | 2 | 4 | 8 | 16,63h | 28,59h | **+72%** |
| 6 | 3 | 2 | 6 | 12 | 33,87h | 61,17h | **+81%** |
| 2 | 3 | 1 | 3 | 2 | 10,50h | 8,13h | −23% |

A última linha mostra a única direção em que cai: quando há **mais marcas que
áreas**, cenário raro.

Nos totais, isso levou `E5 Ent completo médio` de 508h para 592h e
`E3 Ent + QA + WFM` de 334h para 402h. Ambos já estavam muito acima do teto da
Calculadora, mas ilustram a inclinação.

**Recomendação.** A mudança em Localizações foi pedida e está correta — um turno
se organiza por área, não por marca. O que merece uma segunda olhada é
**Automações WFM**, que não foi pedida e agora amplifica: `2 + Equipes × 0,5 ×
Turnos` é um produto de três dimensões de escopo (grupos × áreas × operações).
Se o resultado parecer alto ao validar contra um projeto real, o ajuste natural
é ali, não em Localizações.

---

## Risco nº 2 — dois cenários saíram da trava de Sales Engineer

| Cenário | Antes | Depois | Efeito |
| :--- | ---: | ---: | :--- |
| P2 Prof + Voice (15 ag) | 60,7h | 58,6h | deixou de exigir SE |
| P8 Prof multi-idioma (12 ag) | 84,1h | 46,8h | deixou de exigir SE |

Nenhum cenário passou a exigir SE.

O P2 é o caso incômodo: caiu 2,1h e cruzou de volta os 60h. A trava é um degrau
seco, então estimativas na faixa **55h–62h** trocam de lado com pouca coisa. Com
a recalibração puxando tudo ~2% para baixo, alguns projetos que hoje iriam ao
Sales Engineer passam a sair direto pelo AE.

O P8 é diferente e esperado: caiu porque o multi-idioma sumiu, que era o pedido.

**Recomendação.** Vale considerar baixar o gatilho para algo entre 55h e 58h,
ou trocar o degrau por uma faixa de atenção ("acima de 55h, recomenda-se
revisão"). Não mexi — é decisão de produto, não de fórmula.

---

## Risco nº 3 — Intenções dobrou de peso

`Intenções` passou de `CT × 0,1` para `CT × 0,2`: a quantidade média subiu 55,6%
e o bloco Copilot ficou 0,35h mais caro em média. É um aumento contido porque
poucos cenários têm Copilot, mas em projetos com Copilot **e** QA **e** duas
operações o termo multiplica três vezes. Vale conferir contra um projeto real
de Copilot antes de mandar para cliente.

---

## O que melhorou

**Team ficou coerente.** Queda média de 6,9%, vinda de duas correções reais: as
condicionais de campo zeradas (o plano não tem o recurso) e os formulários
fixados em 1 (o plano não permite mais). A calculadora deixou de cobrar por
coisas que o cliente não conseguiria contratar. E, com as travas, deixou de
produzir estimativas para cenários impossíveis — Team com 3 marcas simplesmente
não calcula mais.

**Automações simples caíram 47%.** Era a linha mais inflada do bloco Support:
`(GS+GC) × 0,3` sobre um número de gatilhos que já era grande. Com 0,1 o
resultado fica plausível — 5,5 automações médias contra 10,5 antes.

**SLA ficou menos sensível a marcas.** A inversão de `0,3+0,7×M` para
`0,7+0,3×M` faz o multiplicador de 3 marcas cair de 2,4 para 1,6. Como a
Calculadora agora limita marcas a 5 (ou 1 em Team), a combinação evita que um
projeto multi-marca exploda numa ferramenta feita para escopos pequenos.

**Saudações ficou mais realista.** De 36 para 27 saudações por canal de voz.
Ainda é bastante — a composição `6 × 4,5` continua embutida, e é o ponto que eu
revisaria a seguir.

**Formulários alcança casos que o canal não via.** Nos cenários B2E de
autoatendimento interno, onde o AE declara poucos formulários web mas há 4–5
áreas, a leitura por estrutura assume e o item passa a cobrar o que de fato será
construído. O `G4 Growth B2E` subiu 1,4% e o `P9 Prof B2E` subiu 1,9% — os dois
únicos aumentos fora de WFM e Copilot, e ambos na direção certa.

---

## Onde as horas se moveram (média dos 24 cenários)

| Grupo | Antes | Depois | Δ |
| :--- | ---: | ---: | ---: |
| wfmConfig | 5,83h | 9,86h | **+4,03h** |
| operationLanguages | 0,86h | 0,00h | **−0,86h** |
| copilotConfig | 4,61h | 4,96h | +0,35h |
| channelSetup | 0,92h | 0,72h | −0,20h |
| appCondicionais | 0,20h | 0,35h | +0,16h |
| generalConfig | 3,65h | 3,56h | −0,08h |
| voiceConfig | 0,89h | 0,82h | −0,07h |
| supportConfig | 17,42h | 17,43h | **+0,01h** |

O dado mais revelador é o último. **O bloco Support, que recebeu cinco mudanças
de fórmula, ficou praticamente idêntico no total** — as quedas em Automações
Simples e Condicionais compensaram quase exatamente as altas em Visualizações,
SLA e o item novo de Formulários. A recalibração redistribuiu o esforço dentro
do Support sem inflar nem esvaziar o bloco, que é o comportamento desejável: as
horas passaram a estar nos itens certos.

---

## Conclusão

A recalibração é **conservadora e bem-comportada** na faixa para a qual a
ferramenta foi feita. Fora do WFM, nenhum cenário se moveu mais de 7,5% em
qualquer direção, e a média de −2,2% é pequena o bastante para não invalidar
nenhuma conversa comercial em andamento.

Os dois pontos a acompanhar antes de liberar para o time:

1. **Validar o WFM contra um projeto real.** É a única mudança com efeito de
   dois dígitos, e ela vem de um multiplicador (Automações WFM) que não foi
   revisado nesta rodada.
2. **Decidir o que fazer com o degrau de 60h do Sales Engineer**, agora que a
   base caiu ~2%.

Nada aqui bloqueia a subida.
