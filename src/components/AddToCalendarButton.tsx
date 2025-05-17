import { AddToCalendarButton } from "add-to-calendar-button-react";
import type { AddToCalendarButtonType } from "add-to-calendar-button-react";

export default function atcb(props: AddToCalendarButtonType) {

  // note that props.startDate + props.startTime is in UTC+0000 
  // note that props.endDate + props.endTime is in UTC+0000

// get user's timezone (required for the AddToCalendarButton)
  let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Asia/Singapore"

  // get date object for start date - this converts it from UTC+0000 to local time in user's timezone
  let startdatetime_utc = new Date(`${props.startDate}T${props.startTime}Z`);

  let start_year = startdatetime_utc.getFullYear(); // 2025
  let start_month = startdatetime_utc.getMonth() + 1; // 4  
  let start_day = startdatetime_utc.getDate(); // 15
  let start_hour = startdatetime_utc.getHours(); // 10
  let start_minute = startdatetime_utc.getMinutes(); // 15

  let start_date = `${start_year}-${start_month.toString().padStart(2, '0')}-${start_day.toString().padStart(2, '0')}`; // "2025-04-15"
  let start_time = `${start_hour.toString().padStart(2, '0')}:${start_minute.toString().padStart(2, '0')}`; // "10:15"

  // get date object for end date - this converts it from UTC+0000 to local time in user's timezone
  let enddatetime_utc = new Date(`${props.endDate}T${props.endTime}Z`);
  let end_year = enddatetime_utc.getFullYear(); // 2025
  let end_month = enddatetime_utc.getMonth() + 1; // 4
  let end_day = enddatetime_utc.getDate(); // 15
  let end_hour = enddatetime_utc.getHours(); // 23
  let end_minute = enddatetime_utc.getMinutes(); // 30

  let end_date = `${end_year}-${end_month.toString().padStart(2, '0')}-${end_day.toString().padStart(2, '0')}`; // "2025-04-15"
  let end_time = `${end_hour.toString().padStart(2, '0')}:${end_minute.toString().padStart(2, '0')}`; // "23:30"

  return (
    <AddToCalendarButton
      label={props.label}
      name={props.name} //"Title"
      options={props.options} //"'Apple','Google'"
      location={props.location} //"World Wide Web"
      startDate={start_date} //"2025-04-15"
      endDate={end_date} //"2025-04-15"
      startTime={start_time} //"10:15"
      endTime={end_time} //"23:30"
      timeZone={userTimezone} //"Asia/Singapore"
    ></AddToCalendarButton>
  );
}
