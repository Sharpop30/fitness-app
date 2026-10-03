// S21 progress chart (UC5, story 4): the top weight per workout (reps for bodyweight), with the personal record marked.
// Shared by coach (from the trainee card) and trainee.
// Design stage, finding 29: the points sit on a time axis by date, with at most four date labels; with many exercises
// the choice is a list. Tiles for the record and the count; the trainee's name for the coach (11); loading and an error
// with a retry (2, 6).
// Stage 5b (prototype 4): a larger chart with a faint grid and a filled area, the record as a full violet point.
import { useState } from "react";
import { useCall } from "../api/useCall";
import { Empty, Field, Load, Name, Pill, Screen, Tile, fmtDate, fmtDateYear } from "../design/components";

export default function S21Progress({ traineeID, name }: { traineeID?: string; name?: string }) {
  const [exerciseID, setExerciseID] = useState<string | undefined>();
  const chart = useCall("S21", "progress", "get_progress_chart", { ...(traineeID ? { traineeID } : {}), ...(exerciseID ? { exerciseID } : {}) });
  return (
    <Screen eyebrow={name ? <Name>{name}</Name> : "התקדמות"} title="גרף התקדמות">
      <Load state={chart}>{(data: any) => {
        if (!data.points.length) return <Empty title="הגרף יופיע אחרי האימונים הראשונים" sub="כל אימון שנשמר מוסיף נקודה." />;
        const pts = data.points as { date: string; value: number }[];
        const W = 340, H = 220, P = 30;
        const vals = pts.map((p) => p.value);
        const lo = Math.min(...vals) * 0.9, hi = Math.max(...vals) * 1.05 || 1;
        const t0 = +new Date(pts[0].date), span = +new Date(pts[pts.length - 1].date) - t0 || 1;
        const X = (p: { date: string }) => (pts.length > 1 ? P + (W - 2 * P) * ((+new Date(p.date) - t0) / span) : W / 2);
        const Y = (v: number) => H - P - (H - 2 * P) * ((v - lo) / (hi - lo || 1));
        const best = Math.max(...vals), bi = vals.lastIndexOf(best);
        const labels = [...new Set([0, Math.round((pts.length - 1) / 3), Math.round((2 * (pts.length - 1)) / 3), pts.length - 1])];
        const unit = data.isBodyweight ? "" : ' ק"ג';
        return <>
          {data.exercises.length > 4
            ? <Field label="תרגיל"><select id="progressExercise" value={data.selected} onChange={(e) => setExerciseID(e.target.value)}>
              {data.exercises.map((e: any) => <option key={e.ExerciseID} value={e.ExerciseID}>{e.exerciseName}</option>)}
            </select></Field>
            : <div className="row wrap">{data.exercises.map((e: any) => <Pill key={e.ExerciseID} on={e.ExerciseID === data.selected} onClick={() => setExerciseID(e.ExerciseID)}>{e.exerciseName}</Pill>)}</div>}
          <div className="grid2">
            <Tile label="שיא אישי" value={`${best}${unit}`} caption={fmtDateYear(pts[bi].date)} />
            <Tile label="אימונים" value={pts.length} caption={`מאז ${fmtDate(pts[0].date)}`} />
          </div>
          <div className="card">
            <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`גרף התקדמות: שיא ${best}${data.isBodyweight ? " חזרות" : unit}`}>
              <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--line-in)" />
              {[0, 1, 2].map((k) => <line key={"g" + k} x1={P} x2={W - P} y1={P + ((H - 2 * P) * k) / 3} y2={P + ((H - 2 * P) * k) / 3} stroke="var(--line)" strokeDasharray="3 4" />)}
              <polygon fill="var(--accSoft)" points={`${X(pts[0])},${H - P} ${pts.map((p) => `${X(p)},${Y(p.value)}`).join(" ")} ${X(pts[pts.length - 1])},${H - P}`} />
              <polyline fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={pts.map((p) => `${X(p)},${Y(p.value)}`).join(" ")} />
              {pts.map((p, i) => <circle key={i} cx={X(p)} cy={Y(p.value)} r={i === bi ? 7 : 3.5} fill={i === bi ? "var(--acc)" : "var(--card)"} stroke="var(--acc)" strokeWidth={i === bi ? 3 : 2} />)}
              {labels.map((i) => <text key={"t" + i} x={X(pts[i])} y={H - 10} textAnchor="middle">{fmtDate(pts[i].date)}</text>)}
              <text x={X(pts[bi])} y={Y(best) - 12} textAnchor="middle">שיא {best}</text>
            </svg>
            <div className="muted small">{data.isBodyweight ? "מספר החזרות הגבוה בכל אימון (תרגיל משקל גוף)" : 'המשקל הגבוה בכל אימון, בק"ג'}. הנקודה המודגשת היא השיא האישי.</div>
          </div>
        </>;
      }}</Load>
    </Screen>
  );
}
