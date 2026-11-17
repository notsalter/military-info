// ruleid: javascript-no-eval
eval(untrustedInput);
// ruleid: javascript-no-eval
new Function(untrustedInput);
// ok: javascript-no-eval
JSON.parse(serializedData);
// ruleid: react-no-raw-html
const unsafe = <div dangerouslySetInnerHTML={{ __html: publisherInput }} />;
// ok: react-no-raw-html
const safe = <div>{publisherInput}</div>;
// ruleid: browser-no-compiled-provider-key
const compiled = import.meta.env.VITE_NEWSAPI_KEY;
// ok: browser-no-compiled-provider-key
const publicSetting = import.meta.env.MODE;
