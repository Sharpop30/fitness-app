-- 0018: the real ready-made list (stage 7 plan, task 20; decision 10; module map section 8, "the ready-made list and its
-- YouTube links"). The eight exercises of the prototype, CoachID null, each with a YouTube link the team approves.
-- Own IDs (prefix e7000000), not marked "(דוגמה)", so demo.unload() leaves them. Locally they load beside the demo
-- list (execution decision 2). Watch links only: the player in components.tsx reads watch?v=, youtu.be and embed.

insert into exercises ("ExerciseID", "exerciseName", "isBodyweight", "videoType", "videoUrl") values
  ('e7000000-0000-4000-8000-000000000001', 'סקוואט',       false, 'youtube', 'https://www.youtube.com/watch?v=v536zvlJJkc'),
  ('e7000000-0000-4000-8000-000000000002', 'לחיצת חזה',    false, 'youtube', 'https://www.youtube.com/watch?v=MjpHpe9bpUw'),
  ('e7000000-0000-4000-8000-000000000003', 'חתירה בכבל',   false, 'youtube', 'https://www.youtube.com/watch?v=V74LKo8YMnw'),
  ('e7000000-0000-4000-8000-000000000004', 'מכרעים',       false, 'youtube', 'https://www.youtube.com/watch?v=tghjGjCCgps'),
  ('e7000000-0000-4000-8000-000000000005', 'שכיבות סמיכה', true,  'youtube', 'https://www.youtube.com/watch?v=O-Tw-QPTv1E'),
  ('e7000000-0000-4000-8000-000000000006', 'דדליפט רומני', false, 'youtube', 'https://www.youtube.com/watch?v=Q79kW80xQOY'),
  ('e7000000-0000-4000-8000-000000000007', 'לחיצת כתפיים', false, 'youtube', 'https://www.youtube.com/watch?v=kF-7ZZwat84'),
  ('e7000000-0000-4000-8000-000000000008', 'מתח',          true,  'youtube', 'https://www.youtube.com/watch?v=Xu5ZCU-vc_E')
on conflict ("ExerciseID") do nothing;
