// S21 progress chart (UC5, story 4): the top weight per workout (reps for bodyweight), with the personal record marked.
// Shared by coach (from the trainee card) and trainee.
import { useState } from "react";
import { useCall } from "../api/useCall";
import { Empty, Pill, Screen, fmtDate } from "../design/components";

export default function S21Progress({ traineeID }: { traineeID?: string }) {
  const [exerciseID, setExerciseID] = useState<string | undefined>();
  const { data } = useCall("S21", "progress", "get_progress_chart", { ...(traineeID ? { traineeID } : {}), ...(exerciseID ? { exerciseID } : {}) });
  if (!data) return <Screen eyebrow="התקדמות" title="גרף התקדמות">{null}</Screen>;
  if (!data.points.length) return <Screen eyebrow="התקדמות" title="גרף התקדמות"><Empty>הגרף יופיע אחרי האימונים הראשונים.</Empty></Screen>;

  const pts = data.points as { date: string; value: number }[];
  const W = 340, H = 180, P = 28;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(...vals) * 0.9, hi = Math.max(...vals) * 1.05 || 1;
  const X = (i: number) => P + (W - 2 * P) * (pts.length > 1 ? i / (pts.length - 1) : 0.5);
  const Y = (v: number) => H - P - (H - 2 * P) * ((v - lo) / (hi - lo || 1));
  const best = Math.max(...vals), bi = vals.lastIndexOf(best);

  return (
    <Screen eyebrow="התקדמות" title="גרף התקדמות">
      <div className="row wrap">{data.exercises.map((e: any) => <Pill key={e.ExerciseID} on={e.ExerciseID === data.selected} onClick={() => setExerciseID(e.ExerciseID)}>{e.exerciseName}</Pill>)}</div>
      <div className="card">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="גרף התקדמות">
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" points={pts.map((p, i) => `${X(i)},${Y(p.value)}`).join(" ")} />
          {pts.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.value)} r={i === bi ? 6 : 3.5} fill={i === bi ? "var(--lime)" : "var(--accent)"} stroke={i === bi ? "var(--ink)" : "none"} />)}
          {pts.map((p, i) => i % 2 === 0 && <text key={"t" + i} x={X(i)} y={H - 8} textAnchor="middle">{fmtDate(p.date)}</text>)}
          <text x={X(bi)} y={Y(best) - 12} textAnchor="middle">שיא {best}</text>
        </svg>
        <div className="muted small">{data.isBodyweight ? "מספר החזרות הגבוה בכל אימון (תרגיל משקל גוף)" : 'המשקל הגבוה בכל אימון, בק"ג'}. הנקודה המודגשת היא השיא האישי.</div>
      </div>
    </Screen>
  );
}
