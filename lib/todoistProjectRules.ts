export interface ProjectRule {
  email: string;
  projectName: string;
}

export const projectRules: ProjectRule[] = [
  {
    email: "oimococo.fujieda@gmail.com",
    projectName: "藤枝・納品スケジュール＆TODO",
  },
];

export const defaultProjectName = "本店・納品スケジュール";

export function getProjectNameForEmail(email: string | null): string {
  if (!email) return defaultProjectName;
  const rule = projectRules.find(
    (r) => r.email.toLowerCase() === email.toLowerCase()
  );
  return rule ? rule.projectName : defaultProjectName;
}
