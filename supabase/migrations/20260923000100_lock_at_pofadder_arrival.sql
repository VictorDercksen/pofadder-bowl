-- Prop board and predictions close when the bus arrives in Pofadder (events.away_arrival_at)
-- instead of at departure. Only moves locks that still sit at departure and have not passed yet,
-- so a board or slip that is already locked (and whose picks are visible) is never reopened.

-- Predictions: the reveal moves with the lock so lock <= reveal still holds.
update public.events e
   set prediction_lock_at = e.away_arrival_at,
       prediction_reveal_at = greatest(e.prediction_reveal_at, e.away_arrival_at)
 where e.prediction_lock_at = e.departure_at
   and now() < e.prediction_lock_at
   and now() < e.prediction_reveal_at
   and e.away_arrival_at > e.prediction_lock_at;

-- Props: every unsettled prop still locking at departure.
update public.props p
   set locks_at = e.away_arrival_at
  from public.events e
 where e.id = p.event_id
   and p.locks_at = e.departure_at
   and p.result is null
   and now() < p.locks_at
   and e.away_arrival_at > p.locks_at;
