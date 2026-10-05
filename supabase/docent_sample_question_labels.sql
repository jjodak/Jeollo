-- Update only the installed Template 1 sample's question labels.
UPDATE public.docent_topics AS t
SET label = v.label
FROM public.heritage_docents AS d,
  (VALUES
    ('buddha', '텍스트 1'),
    ('dating', '텍스트 2'),
    ('making', '텍스트 3')
  ) AS v(topic_key, label)
WHERE d.template_id = 'template_1'
  AND d.background_url = '/docent/template1/sample/background.png'
  AND t.heritage_id = d.heritage_id
  AND t.id = d.heritage_id || ':' || v.topic_key
RETURNING t.id, t.label;
