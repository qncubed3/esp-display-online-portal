"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, FileCode2, FileText, Info } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { buildFirmwareFiles, firmwareZipName } from "@/lib/firmware/files";
import { zipFirmwareFiles } from "@/lib/firmware/zip";

function CopyFileButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#232323] px-2 py-1 text-[12px] text-[#ededed] hover:bg-[#2a2a2a]"
    >
      {copied ? <Check size={13} className="text-[#3ecf8e]" /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-[#2e2e2e] bg-[#161616] px-2.5 py-1.5 text-[13px] text-[#ededed] placeholder:text-[#6b6b6b] focus:border-[#3ecf8e] focus:outline-none";

// Firmware files for one device: view, copy, or download all as a zip.
// Mount it only when it should be open (it reads window.location).
// WiFi details typed here only fill config.h in this tab; they are never sent anywhere.
export default function SetupFilesDialog({
  deviceName,
  deviceKey,
  onClose,
}: {
  deviceName: string;
  deviceKey?: string; // absent: config.h gets the PASTE_DEVICE_KEY_HERE placeholder
  onClose: () => void;
}) {
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [selected, setSelected] = useState(0);

  const serviceUrl = `${window.location.origin}/api/device/frame`;
  const files = useMemo(
    () => buildFirmwareFiles({ serviceUrl, deviceKey: deviceKey ?? "", deviceName, wifiSsid, wifiPassword }),
    [serviceUrl, deviceKey, deviceName, wifiSsid, wifiPassword],
  );
  const file = files[Math.min(selected, files.length - 1)];

  function downloadAll() {
    const zip = zipFirmwareFiles(files);
    const url = URL.createObjectURL(new Blob([new Uint8Array(zip)], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = firmwareZipName(deviceName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Setup files for “${deviceName}”`}
      className="max-w-5xl!"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#2e2e2e] px-2.5 py-1.5 text-[13px] text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={downloadAll}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 py-1.5 text-[13px] font-medium text-[#0f0f0f] hover:bg-[#36b87e]"
          >
            <Download size={14} /> Download all (.zip)
          </button>
        </>
      }
    >
      <div className="space-y-3 text-[13px] text-[#ededed]">
        <p className="text-[#a0a0a0]">
          Arduino sketch for an ESP32 Cheap Yellow Display. Open <code className="font-mono text-[#ededed]">README.md</code> for the
          steps. Only <code className="font-mono text-[#ededed]">config.h</code> is specific to this device.
        </p>

        {!deviceKey && (
          <p className="flex items-start gap-2 rounded-md border border-[#f5b97a]/40 bg-[#f5b97a]/[0.06] px-3 py-2 text-[#f5d3a8]">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              The key is only shown once. Paste it in, or regenerate the key to get files with it filled in.
            </span>
          </p>
        )}

        <div className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-[#a0a0a0]">WiFi name (optional)</span>
              <input
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="YOUR_WIFI"
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-[#a0a0a0]">WiFi password (optional)</span>
              <input
                type="password"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="YOUR_PASSWORD"
                autoComplete="new-password"
                spellCheck={false}
                maxLength={64}
                className={inputClass}
              />
            </label>
          </div>
          <p className="mt-2 text-[12px] text-[#a0a0a0]">
            These only fill in config.h here in your browser. They are never sent to the server or saved. You can also
            leave them blank and edit config.h yourself.
          </p>
        </div>

        <div className="flex min-h-0 flex-col gap-3 sm:flex-row">
          <ul className="flex shrink-0 gap-1 overflow-x-auto sm:w-48 sm:flex-col" role="tablist" aria-label="Files">
            {files.map((f, i) => {
              const name = f.path.split("/").pop() ?? f.path;
              const active = f === file;
              const Icon = name.endsWith(".md") ? FileText : FileCode2;
              return (
                <li key={f.path}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelected(i)}
                    className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left font-mono text-[12px] ${
                      active ? "bg-[#2a2a2a] text-[#ededed]" : "text-[#a0a0a0] hover:bg-[#232323] hover:text-[#ededed]"
                    }`}
                  >
                    <Icon size={13} className={active ? "text-[#3ecf8e]" : undefined} />
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-[#2e2e2e] bg-[#121212]" role="tabpanel">
            <div className="flex items-center justify-between gap-2 border-b border-[#2e2e2e] px-3 py-1.5">
              <span className="truncate font-mono text-[12px] text-[#a0a0a0]">{file.path}</span>
              <CopyFileButton text={file.content} />
            </div>
            <pre className="max-h-[50vh] overflow-auto p-3 font-mono text-[12px] leading-relaxed text-[#ededed]">
              {file.content}
            </pre>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
