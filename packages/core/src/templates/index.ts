// Email templates (Phase 2 plan Tasks 24 and 25): the events and their defaults (Q23), and the single-pass renderer.
export { COMMON_FIELDS, EMAIL_EVENTS, EMAIL_TEMPLATE_DEFAULTS, type EmailEvent, isEmailEvent, type TemplateField } from "./events";
export { escapeHtml, render, renderParts, TemplateFieldError, type TemplatePart, type TemplateProblem, templateProblems } from "./render";
