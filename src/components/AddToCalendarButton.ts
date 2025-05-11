interface CalendarButtonInput {
    startDate: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
}

interface CalendarButtonOutput {
    startDateTime: Date;
    endDateTime: Date;
}

export function getDateTimeForCalendarButton(
    startDate: string, 
    startTime?: string, 
    endDate?: string, 
    endTime?: string
): CalendarButtonOutput {

    function getDateTime(date: string, time: string): Date {
        // time is in the format like "12:00am" or "12:00 AM"
        let t = time;
        // if time is not defined, set it to 00:00
        if (!t) {
            t = "00:00 am";
        }
        // remove space and convert to lowercase, e.g. "12:00 AM" -> "12:00am"
        t = t.replace(/\s+/g, "").toLowerCase();

        // split out hh:mm and am/pm
        let t_split = t.split(/(am|pm)/);
        let t_hhmm = t_split[0];
        let t_am_pm = t_split[1];
        let t_hh = parseInt(t_hhmm.split(":")[0]);
        let t_mm = parseInt(t_hhmm.split(":")[1]);
        
        // convert to 24 hour format
        if (t_am_pm === "pm" && t_hh !== 12) {
            t_hh += 12;
        } else if (t_am_pm === "am" && t_hh === 12) {
            t_hh = 0;
        }

        // compute the duration from 00:00
        let duration_from_0000 = t_hh * 60 + t_mm; 

        // startDate_date is at midnight in the timezone of the date
        // add duration to start date to get start date time of the event
        let date_obj = new Date(date); // this would be 00:00 in the timezone of the date
        let datetime_ts = date_obj.getTime() + duration_from_0000 * 60 * 1000; // add duration to start date
        let datetime_date_obj = new Date(datetime_ts); // this would be 00:00 in UTC

        return datetime_date_obj;
    }

    let startDateTime = getDateTime(startDate, startTime || "00:00 am");

    // by default, end date time is 3 hours after start date time
    let endDateTime = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000); // add 3 hours to start date time
    if (!endDate && !endTime) {
        // if no end date and no end time
        // - then set end date to start date
        // - set end time to 3 hours after start date time
        // endDateTime = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000); // add 3 hours to start date time
    } else if (!endDate && endTime) {
        // got end time but no end date, then set end date to start date
        endDate = startDate;
        endDateTime = getDateTime(endDate, endTime);
    } else if (endDate && !endTime) {
        // if end date is not same as start date, then set end time to 23:59
        if (endDate !== startDate) {
            endTime = "23:59";
            endDateTime = getDateTime(endDate, endTime);
        }
    }

    return {
        startDateTime: startDateTime,
        endDateTime: endDateTime,
    };
}




