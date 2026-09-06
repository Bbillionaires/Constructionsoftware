"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { unstable_rethrow } from "next/navigation";
import { createEstimateFromVoiceAction } from "@/lib/actions/voice-quote";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mic, Square } from "lucide-react";

type Property = { id: string; addressLine1: string; city: string };
type Customer = { id: string; firstName: string; lastName: string; properties: Property[] };

export function VoiceEstimateForm({
  customers,
  defaultCustomerId,
  leadId,
}: {
  customers: Customer[];
  defaultCustomerId?: string;
  leadId?: string;
}) {
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [pending, startTransition] = useTransition();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);

  const properties = customers.find((c) => c.id === customerId)?.properties ?? [];

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType });
        setHasRecording(true);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Couldn't access the microphone — check your browser's permission for this site.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function submit() {
    if (!customerId || !propertyId) {
      toast.error("Pick a customer and property first.");
      return;
    }
    if (!blobRef.current) {
      toast.error("Record something first.");
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("customerId", customerId);
        formData.set("propertyId", propertyId);
        if (leadId) formData.set("leadId", leadId);
        formData.set("audio", blobRef.current!, "quote.webm");
        await createEstimateFromVoiceAction(formData);
      } catch (e) {
        // A successful redirect() from the action throws internally — let that
        // pass through to Next's navigation instead of showing it as an error.
        unstable_rethrow(e);
        toast.error(e instanceof Error ? e.message : "Couldn't build the estimate from that recording.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Customer</Label>
        <select
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setPropertyId("");
          }}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label>Property</Label>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select a property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.addressLine1}, {p.city}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 rounded-md border border-dashed p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Describe the job out loud — the work involved, materials needed, and who supplies them.
        </p>
        {!recording ? (
          <Button type="button" variant="outline" onClick={startRecording} disabled={pending}>
            <Mic className="mr-1 h-4 w-4" /> {hasRecording ? "Record again" : "Start recording"}
          </Button>
        ) : (
          <Button type="button" variant="destructive" onClick={stopRecording}>
            <Square className="mr-1 h-4 w-4" /> Stop recording
          </Button>
        )}
        {hasRecording && !recording && <p className="text-xs text-green-600">Recording captured.</p>}
      </div>

      <Button className="w-full" disabled={!hasRecording || recording || pending} onClick={submit}>
        {pending ? "Building your quote…" : "Build quote from recording"}
      </Button>
    </div>
  );
}
