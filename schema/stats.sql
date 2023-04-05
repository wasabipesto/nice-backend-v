SELECT AVG(
    EXTRACT(
      EPOCH
      FROM (completed_time - claimed_time)
    )
  ) AS avg_seconds_per_field,
  AVG(
    search_range / EXTRACT(
      EPOCH
      FROM (completed_time - claimed_time)
    )
  ) AS avg_hash_rate
FROM SearchFieldsNiceonly
WHERE completed_time > (now() - INTERVAL '1 hour')
  AND completed_time < NOW();