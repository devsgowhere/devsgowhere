import React, { useEffect, useState } from "react";

// Types
type Org = { id: string; data: { title: string } };
type Event = {
  id: string;
  data: {
    title: string;
    tags: string[];
    org: { id: string };
    heroImage: string;
    startDate: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    venue: string;
    venueAddress: string;
    description: string;
  };
};

type EventSearchIndex = {
  id: string;
  title: string;
  tags: string[];
  org: { id: string };
};

interface Props {
  orgs: Org[];
  initialEvents: Event[];
}

const formatEventDate = (
  startDate: string,
  startTime?: string,
  endDate?: string,
  endTime?: string
) => {
  // Simple formatting, adjust as needed
  const start = startTime ? `${startDate} ${startTime}` : startDate;
  let end = "";
  if (endDate) {
    end = endTime ? `${endDate} ${endTime}` : endDate;
  } else if (endTime) {
    end = endTime;
  }
  return end ? `${start} - ${end}` : start;
};

interface EventSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

const EventSearchBox: React.FC<EventSearchBoxProps> = ({ value, onChange }) => (
  <div className="event-search form-control">
    <i className="form-control__prepend fa fa-search"></i>
    <input
      id="event-search__input"
      type="text"
      className="form-control__input"
      placeholder="Search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
    />
  </div>
);

// Improved image resolver: tries public path, falls back to import.meta.glob if available
function resolveImageUrl(heroImage: any): string {
  if (!heroImage) return "";
  if (typeof heroImage === "string") {
    // If absolute URL, return as is
    if (/^https?:\/\//.test(heroImage)) return heroImage;
    // If starts with '/', treat as public path
    if (heroImage.startsWith("/")) return heroImage;
    // Fallback: treat as public path
    return `/${heroImage.replace(/^(\.\/|\/)/, "")}`;
  }
  // If it's an object with a src property (Astro image or import)
  if (typeof heroImage === "object" && typeof heroImage.src === "string") {
    return heroImage.src;
  }
  // Fallback: empty string
  return "";
}

// Add a text normalization function for robust search
function cleanseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_\-]+/g, " ") // underscores/dashes to space
    .replace(/#/g, "") // remove hashtags
    .replace(/[\s]+/g, " ") // collapse whitespace
    .replace(/[^\w\s]/g, "") // remove non-word, non-space chars
    .trim();
}

const EventListContainer: React.FC<Props> = ({ orgs, initialEvents }) => {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [searchIndex, setSearchIndex] = useState<EventSearchIndex[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [filteredIds, setFilteredIds] = useState<string[]>(
    initialEvents.map((e) => e.id)
  );

  useEffect(() => {
    fetch("/events/search-index.json")
      .then((res) => res.json())
      .then((data: EventSearchIndex[]) => setSearchIndex(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchValue) {
      setFilteredIds(events.map((e) => e.id));
      return;
    }
    const value = cleanseText(searchValue);
    const filtered = searchIndex.filter((event) => {
      // Cleanse all compared text
      if (cleanseText(event.title).includes(value)) return true;
      if (
        event.tags.some((tag) => {
          const tagClean = cleanseText(tag);
          return (
            tagClean.includes(value.replace(/^#/, "")) ||
            cleanseText("#" + tag).includes(value)
          );
        })
      )
        return true;
      // Organizer search
      if (event.org && event.org.id) {
        const orgObj = orgs.find((org) => org.id === event.org.id);
        if (orgObj && orgObj.data && typeof orgObj.data.title === "string") {
          if (cleanseText(orgObj.data.title).includes(value)) return true;
        }
      }
      return false;
    });
    setFilteredIds(filtered.map((e) => e.id));
  }, [searchValue, searchIndex, events, orgs]);

  return (
    <div className="container">
      <section>
        <EventSearchBox value={searchValue} onChange={setSearchValue} />
        <ul className="event-list">
          {events.map((event) => {
            const isVisible = filteredIds.includes(event.id);
            return (
              <li
                className={`event-list-item${isVisible ? " show" : ""}`}
                data-id={event.id}
                key={event.id}
                aria-hidden={!isVisible}
              >
                <a className="card" href={`/events/${event.id}/`}>
                  <img
                    width={720}
                    height={360}
                    src={resolveImageUrl(event.data.heroImage)}
                    alt=""
                    style={{ maxWidth: "100%", width: "720px", height: "auto" }}
                  />
                  <div className="event-list-item__info">
                    <div className="org-name text-s text-gray-5 mb-2xs">
                      {
                        orgs.find((org) => org.id === event.data.org.id)?.data
                          .title
                      }
                    </div>
                    <div className="event-title text-accent text-3xl text-bold mb-l">
                      {event.data.title}
                    </div>
                    <div className="event-date mb-xs text-bold">
                      <i className="fa fa-calendar-days mr-xs"></i>
                      {formatEventDate(
                        event.data.startDate,
                        event.data.startTime,
                        event.data.endDate,
                        event.data.endTime
                      )}
                    </div>
                    <div className="event-location mb-0">
                      <div style={{ display: "flex", alignItems: "baseline" }}>
                        <i className="fa fa-location-dot mr-xs"></i>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                          }}
                        >
                          <p className="ml-xs mt-0 mb-0 text-bold">
                            {event.data.venue}
                          </p>
                          <p className="ml-xs mt-0">
                            {event.data.venueAddress}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="event-description mb-m">
                      {event.data.description.slice(0, 200)}...
                    </div>
                    <ul className="tag-list mb-0">
                      {event.data.tags?.slice(0, 5).map((tag) => (
                        <li className="tag" key={tag}>
                          #{tag}
                        </li>
                      ))}
                    </ul>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
        <div
          className="event-list__empty"
          style={{ display: filteredIds.length === 0 ? "block" : "none" }}
        >
          <p className="text-gray-5 text-2xl" style={{ marginTop: "2rem" }}>
            No results found 🥹
          </p>
        </div>
      </section>
      <style>
        {`
        .events-list-page {
          text-align: center;
        }
        ul.event-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li.event-list-item {
          opacity: 0;
          max-height: 0;
          overflow: hidden;
          pointer-events: none;
          transition: opacity 0.3s, max-height 0.3s;
        }
        li.event-list-item.show {
          opacity: 1;
          max-height: 1000px;
          pointer-events: auto;
          transition: opacity 0.3s, max-height 0.3s;
        }
        li.event-list-item a {
          max-width: 720px;
          margin-top: 1rem;
          margin-bottom: 1rem;
          display: inline-block;
          color: inherit;
          text-decoration: none;
        }
        li.event-list-item a:visited {
          color: inherit;
        }
        li.event-list-item a img {
          max-width: 100%;
          width: 720px;
          height: auto;
        }
        .event-list-item__info {
          padding: 2rem;
          text-align: left;
        }
        li.event-list-item a:hover .event-title {
          text-decoration: underline;
          text-decoration-thickness: 2px;
        }
        `}
      </style>
    </div>
  );
};

export default EventListContainer;
