import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInsuranceHtml } from './insurance-html';

test('sanitizeInsuranceHtml strips script and javascript URLs', () => {
  const input = '<p onclick="alert(1)">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">Click</a><table><tr><td>Ok</td></tr></table>';
  const output = sanitizeInsuranceHtml(input);

  assert.doesNotMatch(output, /<script/i);
  assert.doesNotMatch(output, /javascript:/i);
  assert.match(output, /<p>/i);
  assert.match(output, /<table>/i);
});

test('sanitizeInsuranceHtml blocks whitespace-obfuscated javascript: href', () => {
  const vectors = [
    '<a href="jav\tascript:alert(1)">x</a>',
    '<a href="jav\nascript:alert(1)">x</a>',
    '<a href="jav&#x09;ascript:alert(1)">x</a>',
    '<a href="&#106;&#97;vascript:alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>',
  ];
  for (const v of vectors) {
    const output = sanitizeInsuranceHtml(v);
    assert.doesNotMatch(output, /javascript/i, `vector: ${v}`);
    assert.doesNotMatch(output, /href=/i, `href survived: ${v}`);
    assert.match(output, /x<\/a>/, `text lost: ${v}`);
  }
});

test('sanitizeInsuranceHtml blocks data: and vbscript: hrefs', () => {
  for (const v of [
    '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
  ]) {
    const output = sanitizeInsuranceHtml(v);
    assert.doesNotMatch(output, /href=/i, `href survived: ${v}`);
  }
});

test('sanitizeInsuranceHtml blocks event handlers and mXSS', () => {
  const output = sanitizeInsuranceHtml('<img src=x onerror=alert(1)><svg><script>alert(1)</script></svg><math><mtext></form><form><mglyph><style></math><img onerror=alert(1) src=x>');
  assert.doesNotMatch(output, /onerror/i);
  assert.doesNotMatch(output, /<svg/i);
  assert.doesNotMatch(output, /<math/i);
  assert.doesNotMatch(output, /<script/i);
  assert.doesNotMatch(output, /<form/i);
});

test('sanitizeInsuranceHtml keeps safe content and escapes unsafe tags', () => {
  const output = sanitizeInsuranceHtml('<p>Hello <strong>World</strong></p><iframe src="x"></iframe><table><tr><td>A</td></tr></table>');
  assert.match(output, /<p>/i);
  assert.match(output, /<strong>World<\/strong>/i);
  assert.doesNotMatch(output, /<iframe/i);
  assert.match(output, /<td>A<\/td>/i);
});

test('sanitizeInsuranceHtml handles non-string input', () => {
  assert.equal(sanitizeInsuranceHtml(''), '');
  assert.equal(sanitizeInsuranceHtml(null as unknown as string), '');
  assert.equal(sanitizeInsuranceHtml(undefined as unknown as string), '');
});
