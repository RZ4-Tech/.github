#!/usr/bin/env node
// Preenche o PR de release (develop → main) com um `Closes #N` por issue que
// o release leva, para as issues fecharem sozinhas no merge. Padrão da org:
// chamado por .github/workflows/release-closes.yml (workflow reaproveitável).
// Nasceu em RZ4-Tech/barbermanager-app#411.
//
// Por que existe: a `main` é a branch padrão, e o GitHub só fecha issue pelas
// palavras-chave quando o PR entra NELA. O `Closes #N` dos PRs de issue (que
// vão para a develop) não fecha nada; o release precisa repetir cada um. E só
// vale em inglês, uma palavra por issue: o "Fecha #336, #337 e #338" do
// release #405 não fechou nenhuma das três.
//
// Fonte da lista: o git. Os PRs mergeados na develop que ainda não estão na
// main são exatamente o que o release leva; o corpo de cada um diz o que fecha.
//
// Uso:
//   GITHUB_REPOSITORY=RZ4-Tech/<repo> node scripts/release-closes.mjs --dry-run   # só imprime
//   node scripts/release-closes.mjs --pr 412                                      # reescreve o corpo
// Ambiente: GITHUB_TOKEN (local: GITHUB_TOKEN=$(gh auth token)), GITHUB_REPOSITORY
// (obrigatório), BASE (main) e HEAD_REF (develop).

export const INICIO = "<!-- release-closes:inicio -->";
export const FIM = "<!-- release-closes:fim -->";

/**
 * Issues que um corpo de PR fecha, pelas regras do GitHub: as 9 formas em
 * inglês (close/closes/closed, fix/fixes/fixed, resolve/resolves/resolved),
 * maiúsculas ou minúsculas, com dois-pontos opcional, e a referência como
 * `#N`, `dono/repo#N` ou URL da issue — dos dois últimos, só do próprio repo.
 */
export function issuesFechadas(corpo, repo) {
  if (!corpo) return [];
  const [dono, nome] = repo.toLowerCase().split("/");
  const re = new RegExp(
    String.raw`\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+` +
      String.raw`(?:#(\d+)|([\w.-]+)\/([\w.-]+)#(\d+)|https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+))`,
    "gi",
  );
  const achadas = new Set();
  for (const m of corpo.matchAll(re)) {
    if (m[1]) achadas.add(Number(m[1]));
    else if (m[4] && m[2].toLowerCase() === dono && m[3].toLowerCase() === nome) achadas.add(Number(m[4]));
    else if (m[7] && m[5].toLowerCase() === dono && m[6].toLowerCase() === nome) achadas.add(Number(m[7]));
  }
  return [...achadas];
}

/** Texto entre os marcadores, a partir dos PRs do release. */
export function montarSecao(prs, repo) {
  const issues = new Set();
  const semIssue = [];
  for (const pr of prs) {
    const fecha = issuesFechadas(pr.body, repo);
    if (fecha.length === 0) semIssue.push(pr);
    fecha.forEach((n) => issues.add(n));
  }
  const linhas = [
    INICIO,
    "## Issues que este release fecha",
    "_Preenchido pela action `release-closes` a partir dos PRs mergeados na `develop` que ainda não estão na `main`. Não edite entre os marcadores: a próxima atualização sobrescreve._",
    "",
  ];
  if (issues.size === 0) linhas.push("Nenhum PR do release traz `Closes #N`.");
  else [...issues].sort((a, b) => a - b).forEach((n) => linhas.push(`Closes #${n}`));
  if (semIssue.length) {
    linhas.push("", "**PRs sem issue** (confira se falta uma):");
    semIssue.sort((a, b) => a.number - b.number).forEach((pr) => linhas.push(`- #${pr.number} ${pr.title}`));
  }
  linhas.push(FIM);
  return linhas.join("\n");
}

/** Troca a seção entre os marcadores, ou acrescenta no fim. O resto do corpo fica intacto. */
export function aplicarSecao(corpo, secao) {
  const atual = corpo ?? "";
  const i = atual.indexOf(INICIO);
  const f = atual.indexOf(FIM);
  if (i !== -1 && f > i) return atual.slice(0, i) + secao + atual.slice(f + FIM.length);
  return (atual.trimEnd() ? atual.trimEnd() + "\n\n" : "") + secao + "\n";
}

// ── API do GitHub ────────────────────────────────────────────────────────────

async function gh(caminho, init = {}) {
  const res = await fetch(`https://api.github.com${caminho}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${caminho}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/** PRs mergeados em `head` cujos commits ainda não estão em `base`. */
export async function prsDoRelease(repo, base, head) {
  const shas = [];
  for (let page = 1; ; page++) {
    const cmp = await gh(`/repos/${repo}/compare/${base}...${head}?per_page=100&page=${page}`);
    shas.push(...cmp.commits.map((c) => c.sha));
    if (cmp.commits.length < 100) break;
  }
  const prs = new Map();
  for (const sha of shas) {
    for (const pr of await gh(`/repos/${repo}/commits/${sha}/pulls`)) {
      if (pr.merged_at && pr.base.ref === head && !prs.has(pr.number)) {
        prs.set(pr.number, { number: pr.number, title: pr.title, body: pr.body ?? "" });
      }
    }
  }
  return [...prs.values()];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const iPr = args.indexOf("--pr");
  const prNumero = iPr !== -1 ? Number(args[iPr + 1]) : null;
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN ausente (local: GITHUB_TOKEN=$(gh auth token))");
  if (!dry && !prNumero) throw new Error("use --dry-run ou --pr <número>");

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY ausente (ex.: RZ4-Tech/barbermanager-app)");
  const base = process.env.BASE ?? "main";
  const head = process.env.HEAD_REF ?? "develop";

  const prs = await prsDoRelease(repo, base, head);
  const secao = montarSecao(prs, repo);
  if (dry) {
    console.log(`${prs.length} PR(s) em ${base}...${head}\n\n${secao}`);
    return;
  }
  const pr = await gh(`/repos/${repo}/pulls/${prNumero}`);
  const novo = aplicarSecao(pr.body, secao);
  if (novo === (pr.body ?? "")) {
    console.log(`PR #${prNumero}: seção já atualizada (${prs.length} PR(s) no release).`);
    return;
  }
  await gh(`/repos/${repo}/pulls/${prNumero}`, { method: "PATCH", body: JSON.stringify({ body: novo }) });
  console.log(`PR #${prNumero}: seção atualizada (${prs.length} PR(s) no release).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
