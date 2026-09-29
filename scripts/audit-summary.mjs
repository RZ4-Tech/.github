// Resume o `npm audit --json` de cada pasta no job summary e anota o que é
// high/critical. Só reporta — nunca falha o job.
//
// Uso: node scripts/audit-summary.mjs frontend backend e2e
// (lê audit-<pasta>.json no diretório atual). Padrão da org: chamado pelo
// workflow reaproveitável .github/workflows/audit.yml.
import { readFileSync, existsSync, appendFileSync } from "node:fs";

const SEVERIDADES = ["critical", "high", "moderate", "low"];
const linhas = ["## npm audit", "", "| Pasta | critical | high | moderate | low |", "|---|---|---|---|---|"];
const graves = [];

for (const pasta of process.argv.slice(2)) {
  const arquivo = `audit-${pasta}.json`;
  if (!existsSync(arquivo)) {
    linhas.push(`| ${pasta} | — | — | — | — |`);
    continue;
  }
  const dados = JSON.parse(readFileSync(arquivo, "utf8"));
  const v = dados.metadata?.vulnerabilities ?? {};
  linhas.push(`| ${pasta} | ${SEVERIDADES.map((s) => v[s] ?? 0).join(" | ")} |`);

  for (const [nome, info] of Object.entries(dados.vulnerabilities ?? {})) {
    if (info.severity !== "critical" && info.severity !== "high") continue;
    const tipo = info.isDirect ? "direta" : "transitiva";
    const fix = info.fixAvailable ? "tem correção" : "sem correção ainda";
    graves.push(`- **${info.severity}** \`${nome}\` em ${pasta} (${tipo}, ${fix})`);
    console.log(
      `::warning file=${pasta}/package-lock.json,title=npm audit: ${info.severity} em ${nome}::` +
        `Dependência ${tipo} com vulnerabilidade ${info.severity} (${fix}). Rode npm audit em ${pasta}/.`,
    );
  }
}

if (graves.length) linhas.push("", "### high / critical", "", ...graves);
else linhas.push("", "Nenhuma vulnerabilidade high/critical.");

const saida = linhas.join("\n") + "\n";
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, saida);
else process.stdout.write(saida);
