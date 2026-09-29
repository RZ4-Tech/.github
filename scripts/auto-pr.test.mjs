// node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { issueDaBranch, corpoDoPr, tituloDoPr } from "./auto-pr.mjs";
import { issuesFechadas } from "./release-closes.mjs";

test("issueDaBranch lê o número do padrão <tipo>/<N>-<slug>", () => {
  assert.equal(issueDaBranch("fix/412-cadastro-abre-wizard"), 412);
  assert.equal(issueDaBranch("chore/403-cobertura-testes-jornada"), 403);
  assert.equal(issueDaBranch("feature/fusos-fase0"), null);
  assert.equal(issueDaBranch("dependabot/npm_and_yarn/x"), null);
  assert.equal(issueDaBranch("fix/12abc"), null);
});

test("o corpo de branch de issue traz um Closes que o release-closes reconhece", () => {
  const corpo = corpoDoPr("fix/412-cadastro-abre-wizard");
  assert.deepEqual(issuesFechadas(corpo, "RZ4-Tech/qualquer"), [412]);
});

test("branch sem issue não inventa Closes", () => {
  assert.deepEqual(issuesFechadas(corpoDoPr("feature/fusos-fase0"), "RZ4-Tech/qualquer"), []);
});

test("título segue o formato de sempre", () => {
  assert.equal(tituloDoPr("fix/1-x", "develop"), "[Auto] fix/1-x → develop");
});
