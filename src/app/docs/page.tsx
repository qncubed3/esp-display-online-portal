import AppShell from "@/components/layout/AppShell";
import OpsReference from "@/components/docs/OpsReference";
import { B, Code, DocSection, H3, List, Note, P, Pre, Table } from "@/components/docs/Prose";
import { DATUMS, OP_BY_NAME, SCREEN_HEIGHT, SCREEN_WIDTH, SWATCHES } from "@/lib/draw/ops";

export const metadata = { title: "Docs · ESP Display Portal" };

const TOC: { id: string; title: string; subs?: { id: string; title: string }[] }[] = [
  { id: "how-it-works", title: "How it works" },
  {
    id: "data",
    title: "Data section",
    subs: [
      { id: "data-get", title: "get()" },
      { id: "data-now", title: "now()" },
      { id: "data-exports", title: "Exports" },
      { id: "data-secrets", title: "Secrets" },
      { id: "data-errors", title: "Errors" },
      { id: "data-example", title: "Example" },
    ],
  },
  {
    id: "draw",
    title: "Draw section",
    subs: [
      { id: "draw-vars", title: "Variables" },
      { id: "draw-text", title: "Text & fonts" },
      { id: "draw-ops", title: "Ops reference" },
    ],
  },
  { id: "devices", title: "Devices & firmware" },
  { id: "sharing", title: "Sharing" },
  { id: "ai", title: "AI helper" },
  { id: "limits", title: "Limits" },
];

// Values that the docs quote from src/lib/data/run.ts and the device endpoint. Keep in sync.
const POLL_S = 30;
const DISABLED_POLL_S = 300;
const POLLS_PER_DEVICE_MONTH = (86400 / POLL_S) * 30;

const fontOptions = OP_BY_NAME.drawString.fields.find((f) => f.key === "font")?.options ?? [];

const DATA_EXAMPLE = `// Weather from Open-Meteo, refreshed every 10 minutes.
const url = "https://api.open-meteo.com/v1/forecast"
  + "?latitude=-37.81&longitude=144.96&current=temperature_2m,wind_speed_10m";

let temp = "--";
let tempColor = "#808080";
try {
  const w = await get(url, { cache: 600 });
  const t = w.current.temperature_2m;
  temp = Math.round(t) + " C";
  tempColor = t >= 30 ? "#FF0000" : t <= 10 ? "#00FFFF" : "#FFFFFF";
} catch (e) {
  console.log("weather failed:", e.message);
}

export { temp, tempColor };
export const updated = now("ddd HH:mm");   // "Fri 14:05"`;

const DRAW_EXAMPLE = `[
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#000080"],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "Melbourne", 8, 6, 2],
  ["setTextDatum", "TR"],
  ["drawString", "{updated}", 312, 6, 2],
  ["setTextDatum", "MC"],
  ["setTextColor", "{tempColor}"],
  ["setTextSize", 2],
  ["drawString", "{temp}", 160, 120, 4]
]`;

export default function DocsPage() {

  return (
    <AppShell crumbs={[{ label: "Docs" }]}>
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-8">
        <nav aria-label="On this page" className="sticky top-8 hidden w-44 shrink-0 self-start lg:block">
          <p className="mb-2 text-[12px] font-medium text-muted">On this page</p>
          <ul className="space-y-0.5 text-[13px]">
            {TOC.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded px-2 py-1 text-muted hover:bg-panel-hover hover:text-fg">
                  {s.title}
                </a>
                {s.subs && (
                  <ul className="mb-1 ml-2 border-l border-border pl-1">
                    {s.subs.map((t) => (
                      <li key={t.id}>
                        <a
                          href={`#${t.id}`}
                          className="block rounded px-2 py-0.5 text-[12px] text-muted/80 hover:bg-panel-hover hover:text-fg"
                        >
                          {t.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-3xl flex-1 space-y-8">
          <header>
            <h1 className="mb-1 text-xl font-medium">Docs</h1>
            <p className="text-[13px] text-muted">How the portal turns your code into pixels on an ESP32 screen.</p>
          </header>

          {/* ------------------------------------------------------------------ */}
          <DocSection id="how-it-works" title="How it works">
            <P>
              A <B>Service</B> is one screen design. It has two parts: a <B>Data</B> section (JavaScript that fetches and
              formats values) and a <B>Draw</B> section (a list of drawing commands). A <B>Device</B> is an ESP32 with a{" "}
              {SCREEN_WIDTH}×{SCREEN_HEIGHT} screen, subscribed to exactly one Service by its device key. Many devices can
              show the same Service.
            </P>
            <List ordered>
              <li>
                Every ~{POLL_S} seconds each device calls <Code>GET /api/device/frame</Code> with its key.
              </li>
              <li>
                The server runs the Service&apos;s Data code in a sandbox. Its exports become variables.
              </li>
              <li>
                The server fills <Code>{"{name}"}</Code> placeholders in the Draw rows with those variables and turns the
                rows into a JSON list of ops: <Code>{'["drawString", "21 C", 160, 120, 4]'}</Code>.
              </li>
              <li>
                The device plays the ops in order with TFT_eSPI. If nothing changed since its last frame the server answers{" "}
                <Code>304</Code> and the screen is left alone.
              </li>
            </List>
            <P>
              Your code never runs on the device, and nothing runs between polls. Data runs once per poll, per device.
            </P>
            <H3>Save &amp; deploy</H3>
            <P>
              Edits in the Data and Draw sections are local until you click <B>Save &amp; deploy</B> (or press{" "}
              <Code>Ctrl+S</Code>). Devices pick up the saved version on their next poll. The preview always runs your
              current, unsaved code; <B>Refresh data</B> re-runs it.
            </P>
            <H3>Enabled toggle</H3>
            <P>
              The <B>Enabled</B> switch in the Service header turns the Service off for all its devices. A disabled Service
              answers <Code>204</Code>, the device shows <B>Service is turned off</B> and checks again every{" "}
              {DISABLED_POLL_S / 60} minutes. Data code does not run while it is off.
            </P>
          </DocSection>

          {/* ------------------------------------------------------------------ */}
          <DocSection id="data" title="Data section">
            <P>
              Data is an ES module run in a QuickJS sandbox on the server: not Node, not a browser. Top-level{" "}
              <Code>await</Code> works. There is no <Code>fetch</Code>, <Code>require</Code>/<Code>import</Code>,{" "}
              <Code>setTimeout</Code>, filesystem or DOM. Standard built-ins (<Code>JSON</Code>, <Code>Math</Code>,{" "}
              <Code>Date</Code>, string and array methods) are available. <Code>console.log</Code> goes to the server log.
            </P>

            <H3 id="data-get">get(url, {"{ cache }"})</H3>
            <Pre>{`const json = await get("https://example.com/api?key=abc", { cache: 60 });`}</Pre>
            <List>
              <li>
                <B>GET only</B>, <Code>http:</Code>/<Code>https:</Code> only. No custom headers, no POST, no body: API keys
                go in the query string (see <a href="#data-secrets" className="text-accent hover:underline">Secrets</a>).
              </li>
              <li>Returns the body parsed as JSON, or the raw text if it isn&apos;t JSON. Redirects are followed.</li>
              <li>
                <Code>cache</Code> is in seconds, default <B>30</B>. Responses are cached per URL and shared between runs
                (and between Services) on a warm server instance; <Code>cache: 0</Code> always refetches. Use long caches
                for slow data (<Code>{"{ cache: 600 }"}</Code>) to stay under API rate limits. The cache is best-effort: a
                cold start begins empty.
              </li>
              <li>
                Throws on a non-2xx status (<Code>get &lt;url&gt;: HTTP 404</Code>), after <B>5 s</B> (
                <Code>timed out</Code>), or if the body is over <B>1 MB</B>.
              </li>
              <li>
                At most <B>20</B> <Code>get</Code> calls per run. Use <Code>Promise.all</Code> to run them in parallel.
              </li>
            </List>

            <H3 id="data-now">now(format)</H3>
            <P>
              Returns the current time as a string. Default format <Code>&quot;HH:mm&quot;</Code>. Other characters are
              kept as written.
            </P>
            <Table
              head={["Token", "Meaning", "Example"]}
              rows={[
                [<Code key="t">YYYY</Code>, "Year", "2026"],
                [<Code key="t">MM</Code>, "Month, 2 digits", "11"],
                [<Code key="t">DD</Code>, "Day, 2 digits", "20"],
                [<Code key="t">HH</Code>, "Hour 00-23", "14"],
                [<Code key="t">mm</Code>, "Minute", "05"],
                [<Code key="t">ss</Code>, "Second", "09"],
                [<Code key="t">ddd</Code>, "Weekday", "Fri"],
              ]}
            />
            <P>
              <Code>now(&quot;ddd DD/MM HH:mm&quot;)</Code> gives <Code>Fri 20/11 14:05</Code>. Times use the timezone set
              on the <a href="/settings" className="text-accent hover:underline">Settings</a> page (default{" "}
              <Code>Australia/Melbourne</Code>). Prefer <Code>now()</Code> over <Code>Date</Code>, which may not know your
              timezone.
            </P>

            <H3 id="data-exports">Exports become variables</H3>
            <P>
              Every <Code>export const name = …</Code> or <Code>export {"{ name }"}</Code> whose value is a{" "}
              <B>string, number or boolean</B> becomes <Code>{"{name}"}</Code> in Draw. Objects, arrays,{" "}
              <Code>null</Code>, <Code>undefined</Code>, <Code>NaN</Code> and <Code>Infinity</Code> are dropped. Use plain
              identifier names (letters, digits, <Code>_</Code>). Do all formatting (rounding, units, truncating, picking
              colours) here, since Draw can&apos;t compute.
            </P>

            <H3 id="data-secrets">Secrets</H3>
            <P>
              Values saved on the <a href="/secrets" className="text-accent hover:underline">Secrets</a> page are
              available as <Code>secrets.NAME</Code>, so API keys don&apos;t live in your code:
            </P>
            <Pre>{`const r = await get("https://api.example.com/v1/price?apikey=" + secrets.PRICE_KEY);`}</Pre>
            <P>
              A Service always uses its <B>owner&apos;s</B> secrets, including when a member edits it or a device polls
              it.
            </P>

            <H3 id="data-errors">Errors</H3>
            <P>
              If the code throws (including an uncaught <Code>get</Code> failure), no variables are produced and devices
              get a <B>DATA ERROR</B> screen: red heading plus the first ~50 characters of the message, instead of your
              Draw ops. The editor preview shows &quot;Data failed; variables are empty in the preview.&quot; Other errors
              you may see:
            </P>
            <List>
              <li>
                <Code>Data code took too long (over 2s of CPU)</Code>: more than 2 s spent running JavaScript (network waits
                don&apos;t count).
              </li>
              <li>
                <Code>Data code took too long</Code>: the whole run, including waits, passed 15 s.
              </li>
              <li>
                <Code>Data code never finished</Code>: awaiting a promise that never resolves.
              </li>
            </List>
            <P>Wrap flaky calls in <Code>try</Code>/<Code>catch</Code> and export a fallback, so one bad API doesn&apos;t blank the screen.</P>

            <H3 id="data-example">Full example</H3>
            <Pre title="Data">{DATA_EXAMPLE}</Pre>
            <Pre title="Draw → JSON">{DRAW_EXAMPLE}</Pre>
          </DocSection>

          {/* ------------------------------------------------------------------ */}
          <DocSection id="draw" title="Draw section">
            <P>
              Draw is an ordered list of TFT_eSPI commands. They run top to bottom on a {SCREEN_WIDTH}×{SCREEN_HEIGHT}{" "}
              screen (origin top-left, x right, y down); later ops paint over earlier ones. Each frame is drawn from
              scratch, so start with <Code>fillScreen</Code>. Anything off-screen is clipped.
            </P>
            <List>
              <li>
                <B>Rows</B> view: one row per command with a field per argument. Pick a type and click <B>Add row</B>;
                drag a row or press Alt+↑/↓ to reorder. In number fields, ↑/↓ nudges by 1 (Shift: 10).
              </li>
              <li>
                <B>JSON</B> view: the same list as <Code>{'["op", arg1, arg2, …]'}</Code> arrays in argument order. This
                is what the device receives, before variables are filled in. Paste AI output here; a surrounding{" "}
                <Code>```json</Code> fence is ignored. Missing trailing args take their defaults.
              </li>
            </List>
            <P>
              The preview emulates the panel: hard pixels, colours rounded to 16-bit (RGB565), same line/circle algorithms.
              Fonts 2 and 4 are approximations of the device fonts.
            </P>

            <H3 id="draw-vars">Variables and logic</H3>
            <P>
              Any argument can contain <Code>{"{name}"}</Code>, filled from Data exports at poll time:{" "}
              <Code>&quot;Temp: {"{temp}"}&quot;</Code>, a colour <Code>&quot;{"{tempColor}"}&quot;</Code>, or a number{" "}
              <Code>&quot;{"{barW}"}&quot;</Code>. Unknown names become an empty string. Number fields are rounded after
              substitution; anything non-numeric becomes 0. An invalid colour makes that op draw nothing.
            </P>
            <P>
              There are <B>no loops, conditions or expressions</B>. Put the logic in Data and export ready-made values. To
              hide something, export an empty string for its text, 0 for its width, or a colour equal to the background.
            </P>

            <H3 id="draw-text">Text, fonts and anchors</H3>
            <P>
              Text settings are <B>sticky</B>, like TFT_eSPI: <Code>setTextColor</Code>, <Code>setTextSize</Code> and{" "}
              <Code>setTextDatum</Code> apply to every later <Code>drawString</Code> until changed. Start state: white text,
              transparent background, size 1, anchor <Code>TL</Code>. Give <Code>setTextColor</Code> a background colour
              (different from the text colour) to fill the text box first.
            </P>
            <Table
              head={["Font", "Height at size 1", "Width"]}
              rows={fontOptions.map((o) => [
                <Code key="f">{String(o.value)}</Code>,
                o.label.replace(/^\d+:\s*/, ""),
                o.value === 1 ? "6 px per character, fixed" : "proportional",
              ])}
            />
            <P>
              <Code>setTextSize</Code> (1–7) multiplies the font&apos;s pixels: font 4 at size 2 is 52 px tall. Stick to
              printable ASCII; symbols like ° may not render in fonts 2 and 4.
            </P>
            <P>
              <Code>setTextDatum</Code> picks which point of the text box sits at (x, y): first letter{" "}
              <B>T</B>op/<B>M</B>iddle/<B>B</B>ottom, second <B>L</B>eft/<B>C</B>entre/<B>R</B>ight. Values:{" "}
              {DATUMS.map((d, i) => (
                <span key={d}>
                  {i > 0 && " "}
                  <Code>{d}</Code>
                </span>
              ))}
              . Use <Code>MC</Code> with x = {SCREEN_WIDTH / 2} to centre, <Code>TR</Code> with x = {SCREEN_WIDTH - 8} to
              right-align.
            </P>
            <P>
              Colours are <Code>&quot;#RRGGBB&quot;</Code>. Swatches in the editor:{" "}
              {SWATCHES.map((s, i) => (
                <span key={s.hex} className="whitespace-nowrap">
                  {i > 0 && ", "}
                  <span
                    className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-border-strong align-middle"
                    style={{ background: s.hex }}
                  />
                  {s.name}
                </span>
              ))}
              .
            </P>

            <H3 id="draw-ops">Ops reference</H3>
            <P>Generated from the editor&apos;s op list. Args are positional in the JSON view, in this order.</P>
            <OpsReference />
          </DocSection>

          {/* ------------------------------------------------------------------ */}
          <DocSection id="devices" title="Devices & firmware">
            <P>
              The firmware targets the ESP32 &quot;Cheap Yellow Display&quot; (CYD, ST7789, {SCREEN_WIDTH}×{SCREEN_HEIGHT}).
            </P>
            <H3>Add a device</H3>
            <List ordered>
              <li>
                Open a Service and click <B>Add device</B> in its Devices panel. Give it a name.
              </li>
              <li>
                The device key (<Code>esk_…</Code>) is shown <B>once</B>. Copy it now; only its hash is stored. If you lose
                it, <B>Regenerate key</B> (the old key stops working immediately) and update the device.
              </li>
              <li>
                Click <B>Setup files</B> to get the Arduino sketch with the service URL and key filled in. Optionally enter
                your WiFi name and password so <Code>config.h</Code> is ready to go, then <B>Download all (.zip)</B>.
              </li>
            </List>
            <P>
              A device shows as online if it polled in the last 2 minutes. Deleting a device revokes its key.
            </P>

            <H3>Flash it with the Arduino IDE</H3>
            <P>
              The zip contains <Code>EspDisplay.ino</Code>, <Code>config.h</Code> (the only per-device file: WiFi, URL,
              key; keep it private), <Code>User_Setup.h</Code> and a <Code>README.md</Code> with the full steps. In short:
            </P>
            <List ordered>
              <li>Install Arduino IDE 2.x and the <B>esp32 by Espressif Systems</B> board package.</li>
              <li>
                Install the libraries <B>TFT_eSPI</B> (Bodmer) and <B>ArduinoJson 7.x</B>.
              </li>
              <li>
                Copy <Code>User_Setup.h</Code> over <Code>Documents/Arduino/libraries/TFT_eSPI/User_Setup.h</Code>. TFT_eSPI
                only reads its own folder; redo this after updating the library. The sketch refuses to build if you forget.
              </li>
              <li>
                Open <Code>EspDisplay.ino</Code>, check <Code>config.h</Code> (WiFi is 2.4 GHz only), choose{" "}
                <B>ESP32 Dev Module</B> and the port, then <B>Upload</B>. Hold BOOT if the upload doesn&apos;t start.
              </li>
              <li>Serial Monitor at 115200 baud shows what the device is doing.</li>
            </List>
            <P>
              Red and blue swapped? Set <Code>TFT_RGB_ORDER</Code> to <Code>TFT_RGB</Code> in <Code>User_Setup.h</Code>. If
              TFT_eSPI won&apos;t compile on your core, try esp32 core 2.0.17.
            </P>

            <H3>What the screen shows</H3>
            <Table
              head={["On screen", "Meaning"]}
              rows={[
                ["Connecting to WiFi / WiFi connected", "Joining your network on boot."],
                ["Your design", "First poll succeeded. It redraws only when the frame changes."],
                ["Small red dot, top-right", "Last update failed (WiFi or server). The last screen stays up; it keeps retrying."],
                ["Device key rejected", "Key in config.h is wrong, regenerated or deleted. Put the current key in and re-upload."],
                ["Service is turned off", "The Service is disabled. Checks again every few minutes."],
                ["Setup needed", "config.h still has a placeholder (WiFi or key)."],
                ["DATA ERROR", "The Service's Data code failed. Fix it in the portal; no re-flash needed."],
              ]}
            />

            <H3>Protocol and diagnostics</H3>
            <P>
              Devices call <Code>GET /api/device/frame?since=&lt;id&gt;</Code> with{" "}
              <Code>Authorization: Bearer esk_…</Code>. Responses: <Code>200</Code> frame JSON, <Code>304</Code> unchanged,{" "}
              <Code>204</Code> disabled, <Code>401</Code> bad key; <Code>X-Next-Poll</Code> says when to call again. To test
              without a device:
            </P>
            <Pre>{`curl "https://<your-portal>/api/device/frame?key=esk_..."`}</Pre>
            <P>
              The firmware also sends optional headers that are logged with each poll and shown in activity stats:{" "}
              <Code>X-RSSI</Code> (WiFi signal, dBm), <Code>X-Heap</Code> (free memory, bytes), <Code>X-Uptime</Code>{" "}
              (seconds since boot) and <Code>X-FW</Code> (firmware version). Custom firmware can send them too.
            </P>
          </DocSection>

          {/* ------------------------------------------------------------------ */}
          <DocSection id="sharing" title="Sharing">
            <Table
              head={["", "Owner", "Member"]}
              rows={[
                ["Edit Data and Draw, Save & deploy", "Yes", "Yes"],
                ["Enable / disable, rename", "Yes", "Yes"],
                ["Add, regenerate and delete devices", "Yes", "Yes"],
                ["Invite or remove members", "Yes", "No"],
                ["Delete the Service", "Yes", "No (can leave)"],
                ["Whose secrets the Data code uses", "Owner's", "Owner's"],
              ]}
            />
            <List>
              <li>
                <B>Invite</B>: click <B>Share</B> in the Service header and enter an email. The person must already have an
                account. They get a notification (bell, top-right) and the Service appears under{" "}
                <a href="/shared" className="text-accent hover:underline">Shared with me</a>.
              </li>
              <li>
                <B>Leave</B>: a member clicks <B>Leave</B> in the Service header. The owner can also remove members from the
                Share dialog.
              </li>
            </List>
          </DocSection>

          {/* ------------------------------------------------------------------ */}
          <DocSection id="ai" title="AI helper">
            <P>
              The <B>AI helper</B> buttons give you a ready-made prompt that teaches ChatGPT or Claude this platform&apos;s
              exact Data and Draw rules. No API key or integration needed; you use the chat in your browser.
            </P>
            <List>
              <li>
                <B>Data header → AI helper</B>: builds a whole Service. The reply has a <Code>```js</Code> block (Data) and a{" "}
                <Code>```json</Code> block (Draw).
              </li>
              <li>
                <B>Draw → AI helper</B>: layout only, seeded with your current variables. The reply is a{" "}
                <Code>```json</Code> block.
              </li>
            </List>
            <List ordered>
              <li>Click the button and <B>Copy</B> the prompt (or download it as <Code>SKILL.md</Code> to add as a Claude skill).</li>
              <li>
                Paste it into a new chat on chatgpt.com or claude.ai. Describe the screen and give the API URLs, ideally
                with a sample JSON response.
              </li>
              <li>
                Paste the <Code>js</Code> block into Data and the <Code>json</Code> block into <B>Draw → JSON</B>, replacing
                what&apos;s there.
              </li>
              <li>
                Click <B>Refresh data</B>, check the preview, ask the AI for tweaks, then <B>Save &amp; deploy</B>.
              </li>
            </List>
            <Note>
              Don&apos;t paste real API keys into the chat. Store them as Secrets and tell the AI to use{" "}
              <Code>secrets.NAME</Code>. If an API needs headers or POST, <Code>get</Code> can&apos;t call it directly.
            </Note>
          </DocSection>

          {/* ------------------------------------------------------------------ */}
          <DocSection id="limits" title="Limits">
            <H3>Hosting (Vercel Hobby)</H3>
            <P>
              Every poll is one serverless invocation. Vercel Hobby allows about <B>1,000,000 invocations a month</B>. One
              device polling every {POLL_S} s makes ~{POLLS_PER_DEVICE_MONTH.toLocaleString("en-US")} a month, so the
              portal supports about <B>{Math.floor(1_000_000 / POLLS_PER_DEVICE_MONTH)} always-on devices</B> in total, with
              a little left for editing and previews. Disabled Services cost one poll per device every{" "}
              {DISABLED_POLL_S / 60} minutes.
            </P>
            <H3>Data sandbox</H3>
            <Table
              head={["Limit", "Value"]}
              rows={[
                ["CPU time running JavaScript", "2 s per run"],
                ["Total run time, including network waits", "15 s"],
                ["Memory", "32 MB"],
                ["get() calls per run", "20"],
                ["get() timeout", "5 s"],
                ["get() response size", "1 MB"],
                ["get() default cache", "30 s"],
                ["Message on the DATA ERROR screen", "~50 characters"],
              ]}
            />
          </DocSection>
        </article>
      </div>
    </AppShell>
  );
}
