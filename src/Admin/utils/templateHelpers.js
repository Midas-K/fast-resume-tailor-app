export function sortResumeTemplatesForAdmin(templates = []) {
  return [...templates].sort((a, b) => {
    if (Boolean(a.is_default) !== Boolean(b.is_default)) {
      return a.is_default ? -1 : 1;
    }

    return new Date(a.created_at) - new Date(b.created_at);
  });
}

export function splitResumeTemplates(templates = []) {
  const sorted = sortResumeTemplatesForAdmin(templates);
  const defaultTemplate = sorted.find((template) => template.is_default) || null;
  const otherTemplates = sorted.filter((template) => !template.is_default);

  return { defaultTemplate, otherTemplates, sorted };
}
