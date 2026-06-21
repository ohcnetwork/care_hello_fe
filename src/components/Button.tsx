import { Link } from "raviger";
import { Button } from "./ui/button";
import type { EncounterRead } from "@/types/pluginManifest";

// Host slot contract: PatientInfoCardQuickActions = FC<{ encounter: EncounterRead; className? }>.
// The host also injects a `__meta` prop at runtime (optional, ignore unless needed).
export default function HelloButton(props: {
  className?: string;
  encounter: EncounterRead;
}) {
  return (
    <div className="care-hello-container">
      <Button className={props.className} variant={"default"}>
        <Link href={`/hello`}>Hello!</Link>
      </Button>
    </div>
  );
}
