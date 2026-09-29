// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { issuesFechadas, montarSecao, aplicarSecao, INICIO, FIM } from "./release-closes.mjs";

const REPO = "RZ4-Tech/barbermanager-app";

test("reconhece as formas em inglês, com e sem dois-pontos e maiúsculas", () => {
  const corpo = [
    "Closes #1", "fixes #2", "Resolves: #3", "CLOSED #4", "fix #5", "Fixed #6",
    "resolve #7", "resolved #8", "close #9",
  ].join("\n");
  assert.deepEqual(issuesFechadas(corpo, REPO).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("aceita URL e dono/repo#N do próprio repo; ignora os de outro repo", () => {
  const corpo = [
    "Closes https://github.com/RZ4-Tech/barbermanager-app/issues/10",
    "Fixes rz4-tech/barbermanager-app#11",
    "Closes https://github.com/RZ4-Tech/komio/issues/12",
    "Fixes RZ4-Tech/infra-core#13",
  ].join("\n");
  assert.deepEqual(issuesFechadas(corpo, REPO), [10, 11]);
});

test("não conta português, menção solta nem palavra dentro de outra", () => {
  const corpo = "Fecha #20\nParte da #21\nVer #22\nprefix #23\nCloses a #24";
  assert.deepEqual(issuesFechadas(corpo, REPO), []);
});

test("cada issue com a própria palavra: 'Closes #1, #2' só fecha a #1 (regra do GitHub)", () => {
  assert.deepEqual(issuesFechadas("Closes #30, #31", REPO), [30]);
});

test("montarSecao: uma linha por issue, deduplicada e em ordem; PR sem issue vira aviso", () => {
  const secao = montarSecao([
    { number: 410, title: "Cobertura", body: "Closes #403" },
    { number: 412, title: "Outro", body: "fixes #406\nCloses #403" },
    { number: 413, title: "Bump de dependência", body: "sem issue" },
  ], REPO);
  assert.ok(secao.startsWith(INICIO) && secao.endsWith(FIM));
  assert.deepEqual(secao.match(/^Closes #\d+$/gm), ["Closes #403", "Closes #406"]);
  assert.match(secao, /PRs sem issue.*\n- #413 Bump de dependência/s);
});

test("montarSecao sem nenhum Closes diz isso", () => {
  assert.match(montarSecao([{ number: 1, title: "x", body: "" }], REPO), /Nenhum PR do release traz/);
});

test("aplicarSecao acrescenta no fim e preserva o texto do autor", () => {
  const secao = montarSecao([{ number: 1, title: "x", body: "Closes #5" }], REPO);
  const corpo = aplicarSecao("Release da semana.\n\nNotas minhas.", secao);
  assert.ok(corpo.startsWith("Release da semana.\n\nNotas minhas.\n\n" + INICIO));
});

test("aplicarSecao troca só o trecho entre os marcadores e é idempotente", () => {
  const v1 = montarSecao([{ number: 1, title: "x", body: "Closes #5" }], REPO);
  const v2 = montarSecao([{ number: 1, title: "x", body: "Closes #5" }, { number: 2, title: "y", body: "Closes #6" }], REPO);
  const corpo1 = aplicarSecao("Antes\n", v1) + "\nDepois do autor";
  const corpo2 = aplicarSecao(corpo1, v2);
  assert.ok(corpo2.startsWith("Antes\n\n" + INICIO));
  assert.ok(corpo2.endsWith(FIM + "\n\nDepois do autor"));
  assert.deepEqual(corpo2.match(/^Closes #\d+$/gm), ["Closes #5", "Closes #6"]);
  assert.equal(aplicarSecao(corpo2, v2), corpo2);
});

test("corpo vazio ou nulo recebe só a seção", () => {
  const secao = montarSecao([], REPO);
  assert.equal(aplicarSecao(null, secao), secao + "\n");
  assert.equal(aplicarSecao("", secao), secao + "\n");
});
