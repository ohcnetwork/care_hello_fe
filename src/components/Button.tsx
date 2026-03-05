import { Link } from "raviger";
import { Button } from "./ui/button";

export default function PrescriptionPadButton(props: {
  className?: string;
  encounter: { id: string };
  patientId: string;
  facilityId: string;
}) {
  return (
    <div className="prescription-pad-container">
      <Button className={props.className} variant={"default"}>
        <Link
          href={`/facility/${props.facilityId}/patient/${props.patientId}/encounter/${props.encounter.id}/prescription-pad`}
        >
          Prescription Pad
        </Link>
      </Button>
    </div>
  );
}
