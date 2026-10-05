import { Template1 } from './templates/Template1.jsx';
import './docent.css';

// Register the next renderer here; heritage rows contain no rendering code.
const renderers = { template_1: Template1 };

export function hasDocentRenderer(experience) {
  return Boolean(experience?.topics?.length && Object.hasOwn(renderers, experience.templateType));
}

export function DocentPlayer({ heritage, onDetail, fallback = null }) {
  const experience = heritage?.docentExperience;
  if (!hasDocentRenderer(experience)) return fallback;
  const Renderer = renderers[experience.templateType];
  return <Renderer key={heritage.id} heritage={heritage} experience={experience} onDetail={onDetail} />;
}
