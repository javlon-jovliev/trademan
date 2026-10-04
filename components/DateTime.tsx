export function dateKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function DateTime({
  value,
  timeZone,
  language,
}: {
  value: string;
  timeZone: string;
  language: "uz" | "en";
}) {
  const date = new Date(value);
  if (!Number.isFinite(+date)) return <span>—</span>;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const months =
    language === "uz"
      ? [
          "yan",
          "fev",
          "mar",
          "apr",
          "may",
          "iyun",
          "iyul",
          "avg",
          "sen",
          "okt",
          "noy",
          "dek",
        ]
      : [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(date);
  return (
    <time
      className="table-datetime"
      dateTime={value}
      title={`${date.toISOString()} · ${timeZone}`}
    >
      <span>
        {part("day")} {months[Number(part("month")) - 1]} {part("year")}
      </span>
      <small>{clock}</small>
    </time>
  );
}

export function dateLabel(
  value: string,
  timeZone: string,
  language: "uz" | "en",
) {
  if (!Number.isFinite(+new Date(value))) return "—";
  const [year, month, day] = dateKey(value, timeZone).split("-");
  const months =
    language === "uz"
      ? [
          "yan",
          "fev",
          "mar",
          "apr",
          "may",
          "iyun",
          "iyul",
          "avg",
          "sen",
          "okt",
          "noy",
          "dek",
        ]
      : [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}
