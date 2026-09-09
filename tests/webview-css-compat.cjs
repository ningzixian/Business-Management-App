// Run after a production/mobile build: WebView 99 ignores media range syntax.
const fs=require('node:fs'),assert=require('node:assert/strict');
const files=fs.readdirSync('dist/assets').filter(f=>f.endsWith('.css'));
assert.ok(files.length);
for(const file of files){
 const css=fs.readFileSync('dist/assets/'+file,'utf8');
 const media=css.match(/@media[^\{]+/g)||[];
 assert.ok(media.some(q=>q.includes('max-width:980px')));
 assert.ok(!media.some(q=>/[<>]=?/.test(q)),`Unsupported media range in ${file}`);
}
console.log('PASS: compiled responsive CSS uses WebView 99 compatible media queries');
