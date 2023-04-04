-- Clients are being given bases they can't handle, this just wipes those so 
-- they stop getting re-assigned
DELETE FROM SearchFieldsDetailed
WHERE completed_time IS NULL
    AND base > 97;