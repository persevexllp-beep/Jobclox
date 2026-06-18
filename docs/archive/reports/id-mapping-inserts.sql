-- Optional id_mappings seed SQL (review before applying)
-- Suggested schema:
-- CREATE TABLE IF NOT EXISTS public.id_mappings (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   entity_type text NOT NULL,
--   old_id text NOT NULL,
--   new_id uuid NOT NULL,
--   matched_by text,
--   confidence text,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   UNIQUE (entity_type, old_id)
-- );

INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence) VALUES ('users', 'u-admin', '2d8a82c1-0d87-422e-984a-c944e9205c24', NULL, NULL) ON CONFLICT (entity_type, old_id) DO NOTHING;
INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence) VALUES ('users', 'u-comp1', '17e8c472-e13b-41c0-9505-640acfce3fed', NULL, NULL) ON CONFLICT (entity_type, old_id) DO NOTHING;
INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence) VALUES ('users', 'u-cand1', '374aff99-12d2-4f61-9c40-33a8b19b5f71', NULL, NULL) ON CONFLICT (entity_type, old_id) DO NOTHING;
INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence) VALUES ('companies', 'c-aws', 'ebca53fd-f3dd-4bce-b46c-e7633a769b75', NULL, NULL) ON CONFLICT (entity_type, old_id) DO NOTHING;
INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence) VALUES ('candidate_profiles', 'can-alex', 'a58996d0-0a8e-4dc9-a344-0543a4796f72', NULL, NULL) ON CONFLICT (entity_type, old_id) DO NOTHING;