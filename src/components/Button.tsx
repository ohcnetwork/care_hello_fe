import { Link } from "raviger";
import { Button } from "./ui/button";

export default function HelloButton(props: {
  className?: string;
  encounter: { id: string };
  patientId: string;
  facilityId: string;
}) {
  return (
    <div className="care-hello-container">
      <Button className={props.className} variant={"default"}>
        <Link href={`/hello`}>Hello!</Link>
      </Button>
    </div>
  );
}
