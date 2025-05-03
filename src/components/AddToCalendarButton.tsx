import { AddToCalendarButton } from "add-to-calendar-button-react";
import type { AddToCalendarButtonType } from "add-to-calendar-button-react";

export default function atcb(props: AddToCalendarButtonType) {
  return (
    <AddToCalendarButton
      label={props.label}
      name={props.name} //"Title"
      options={props.options} //"'Apple','Google'"
      location={props.location} //"World Wide Web"
      startDate={props.startDate} //"2025-04-15"
      endDate={props.endDate} //"2025-04-15"
      startTime={props.startTime} //"10:15"
      endTime={props.endTime} //"23:30"
      timeZone={props.timeZone} //"America/Los_Angeles"
    ></AddToCalendarButton>
  );
}
