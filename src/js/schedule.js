// * schedule class contains a map of days with arrays of time blocks. Each tutor and room will have a schedule.

class Schedule {
    constructor(container) { // container is a back reference to the tutor or room that has the schedule
        this.container = container;
        this.range = null;
        this.week = {
            "M": [],
            "Tu": [],
            "W": [],
            "Th": [],
            "F": [],
            "Sat": [],
            "Sun": []
        }
    }

    setRange(range) {
        this.range = range;
        return this;
    }

    // expects a string formatted as "day(s) HH:MM [AM/PM]" or "day(s) HH:MM [AM/PM] - HH:MM [AM/PM]"
    // course and tag arguments used primarily by tutor schedules for display purposes
    // tutor argument is a string for the tutor's email (key to Tutors map), and is used by room schedules to track which tutor is assigned to the time
    addTime(timeStr, course="COURSE", tag="session", tutor=null, scheduleByLSS=true) {
        if (timeStr == "N/A") return false;

        // split string at an arbitrary space to prevent days from including the "M" from PM/AM
        let halves = timeStr.split(":");

        let days = halves[0].match(/(M|Tu|W|Th|F|Sat|Sun)/g); // get all days
        let hours = timeStr.match(/[0-9]{1,2}:[0-9]{1,2}[\s]*(AM|PM|am|pm)*/g); // get all hours

        if (hours == null) {
            return {
                day: "N/A",
                time: { tutor: tutor, course: course, tag: tag, start: null, end: null, scheduleByLSS: scheduleByLSS },
                error: "no-time"
            }
        }
        
        // if there are no days, then this is a Sun time
        if (days == null) { days = ["Sun"]; }

        // add AM or PM to first time if it's missing
        if (hours[0].match(/(AM|PM|am|pm)/g) == null) {
            if (hours[1].split(":")[0].trim() == "12") {
                hours[0] += hours[1].match(/(AM|am)/g) == null ? "AM" : "PM";
            } else {
                hours[0] += hours[1].match(/(AM|am)/g) == null ? "PM" : "AM";
            }
        }
        // console.log(timeStr, days, hours);

        // get int time values
        const start = convertTimeToInt(hours[0]);
        const end = hours.length > 1 ? convertTimeToInt(hours[1]) : start + 60; // add 60 minutes if no second time

        // check if time is within the room's valid time range
        if (this.container instanceof Room && this.range != null) {
            for (const day of days) {
                let matches = false;
                for (const validDay of this.range.days) {
                    if (day == validDay) {
                        matches = true;
                        break;
                    }
                }
                if (!matches) {
                    return {
                        day: day,
                        time: { tutor: tutor, course: course, tag: tag, start: start, end: end, scheduleByLSS: scheduleByLSS },
                        error: "invalid"
                    };
                }
            }

            if (start < this.range.start || this.range.end < end) {
                return {
                    day: null,
                    time: { tutor: tutor, course: course, tag: tag, start: start, end: end, scheduleByLSS: scheduleByLSS },
                    error: "invalid"
                };
            }
        }

        // check if time is valid if it is a session and schedule is for a tutor
        if (this.container instanceof Tutor && tag == "session") {
            for (const day of days) {
                if (day == "Sun" || day == "Sat") { continue; }

                // returns true if time is valid, isValidSessionTime() in session-times.js
                if (!isValidSessionTime(day, start)) {
                    return {
                        day: day,
                        time: { tutor: tutor, course: course, tag: tag, start: start, end: end, scheduleByLSS: scheduleByLSS },
                        error: "invalid"
                    };
                }
            }
        }

        // check for overlapping times
        for (let i = 0; i < days.length; i++) {
            for (let j = 0; j < this.week[days[i]].length; j++) {
                if (start >= this.week[days[i]][j].start && start <= this.week[days[i]][j].end) {
                    if (this.container instanceof Room && this.week[days[i]][j].tutor == tutor) { // if this is the same session time for the same tutor, just replace it
                        // add new time to schedule
                        this.week[days[i]][j] = {
                            tutor: tutor, 
                            course: course,
                            tag: tag,
                            start: start,
                            end: end
                        };
                        if (tag == "session") {
                            this.week[days[i]][j].scheduleByLSS = scheduleByLSS;
                        }

                        return {
                            day: days[i],
                            time: { tutor: tutor, course: course, tag: tag, start: start, end: end, scheduleByLSS: scheduleByLSS  },
                            error: "replaced"
                        };
                    }

                    return {
                        day: days[i],
                        time: { tutor: tutor, course: course, tag: tag, start: start, end: end, scheduleByLSS: scheduleByLSS  },
                        error: "conflict"
                    };
                    
                }
                if (end >= this.week[days[i]][j].start && end <= this.week[days[i]][j].end) {
                    //console.log("Overlapping time");
                    return {
                        day: days[i],
                        time: { tutor: tutor, course: course, tag: tag, start: start, end: end, scheduleByLSS: scheduleByLSS  },
                        error: "conflict"
                    };
                }
            }
        }

        
        for (let day of days) {
            // check if day has too many sessions already for room schedules
            if (this.container instanceof Room && tag == "session" && this.week[day].length >= 4) {
                return {
                    day: days[day],
                    time: { tutor: tutor, course: course, tag: tag, start: start, end: end, scheduleByLSS: scheduleByLSS  },
                    error: "over-booked"
                };
            }

            // add new time to schedule
            this.week[day].push({
                tutor: tutor, 
                course: course,
                tag: tag,
                start: start,
                end: end
            });
            if (tag == "session") {
                this.week[day].at(-1).scheduleByLSS = scheduleByLSS;
            }
        }

        // sort schedule by start time
        for (let day of days) {
            this.week[day].sort((a, b) => a.start - b.start);
        }

        return null;
    }

    // returns the time that was removed
    removeTime(day, tag, startTime) {

        for (let i = 0;  i < this.week[day].length; i++) {
            const time = this.week[day][i];
            if (time.start == startTime && time.tag == tag) {
                return this.week[day].splice(i, 1)[0];
            }
        }
    }

    getTime(day, tag, startTime) {
        for (let i = 0;  i < this.week[day].length; i++) {
            let time = this.week[day][i];
            if (time.start == startTime && time.tag == tag) {
                return time;
            }
        }
        return null;
    }

    // expects string formatted as "DAY ##:## AM/PM"
    getTimeByStr(timeStr, tag="session") {
        let halves = timeStr.split(":");
        let days = halves[0].match(/(M|Tu|W|Th|F|Sat|Sun)/g); // get all days
        let day = days == null ? "Sun" : days[0];

        let formattedDate = (days == null ? "SUN" : "") + timeStr.trim().toUpperCase().replace(/ /g, "");

        for (const time of this.week[day]) {
            console.log("time: ", `${day} ${convertTimeToString(time.start)}`.toUpperCase().replace(/ /g, ""));
            if (formattedDate == `${day} ${convertTimeToString(time.start)}`.toUpperCase().replace(/ /g, "") && time.tag == tag) {
                return time;
            }
        }
        return null;
    }

    // returns the schedule formatted as a string
    Display() {
        let output = "";

        for (let day in this.week) {
            output += `<b>${day}:</b></br>`;

            const times = this.week[day];

            for (let i = 0; i < times.length; i++) {
                const time = times[i];

                // if displaying schedule for tutor with assigned sessions
                if (this.container instanceof Tutor && FinishedStatus.includes(this.container.courses[time.course].status)) {
                    if (!("room" in time)) continue;
                }

                let confirmed = false;
                if (this.container instanceof Tutor) {
                    confirmed = (this.container.courses[time.course].status == StatusOptions.ScheduleConfirmed);
                }
                
                let body = "";
                if (this.container instanceof Room) {
                    if (tutors != null && time.tutor in tutors) {
                        body = time.course + " , " + tutors[time.tutor].name + " / " + time.tutor + " , ";
                        confirmed = (tutors[time.tutor].courses[time.course].status == StatusOptions.ScheduleConfirmed);
                    } else {
                        body = time.tutor;
                    }
                } else {
                    if ("room" in time && time.room != null) {
                        body = time.course + " / <b>" + time.room + "</b>";
                    } else {
                        body = time.course;
                    }
                }
                let tag = time.tag == "office hours" ? "office-hours" : (confirmed ? "confirmed" : time.tag);
                output += `<div class='time ${tag}'>|` + ` (${body}`;
                output += ` ${time.tag}: ${convertTimeToString(time.start)} - ${convertTimeToString(time.end)}) `;
                output += "|";

                // remove time button
                if (!confirmed) {
                    output += ` <button type='submit' onclick="removeTime(`;
                    if (this.container instanceof Room) {
                        output += `'${this.container.name}', `;
                    } else {
                        output += `'${this.container.email}', `;
                    }
                    output += `'${day}', '${time.tag}', '${time.start}')">Remove</button>`;
                }
                

                output += "</div></br>";
            }

            output += "</br></br>";
        }

        return output;
    }

    // return a string representation of the schedule that will paste into a spreadsheet
    Copy(assigned=false) {
        let output = "";

        for (let day in this.week) {
            output += day + "\t";

            const times = this.week[day];

            for (let time of times) {
                if (assigned) {
                    if (!("room" in time)) continue;
                }
                
                let body = "";
                if (this.container instanceof Room) {
                    if (tutors != null && time.tutor in tutors) {
                        body = time.course + " , " + tutors[time.tutor].name + " (" + time.tutor + ") , ";
                    } else {
                        body = time.course + " , " + " (" + time.tutor + ") , ";
                    }
                } else {
                    if ("room" in time) {
                        body = time.course + " , " + time.room + " , ";
                    } else {
                        body = time.course;
                    }
                }
                output += body;
                output += `${convertTimeToString(time.start)} - ${convertTimeToString(time.end)}\t`;
            }

            output += "\n";
        }

        return output;
    }
}