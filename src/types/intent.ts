export type IntentType =
  | "component.create"
  | "component.update"
  | "component.delete"
  | "component.duplicate"
  | "page.create"
  | "page.delete"
  | "nav.add"
  | "ui.setColor"
  | "ui.setTheme"
  | "ui.setLayout"
  | "nav.go"
  | "file.create"
  | "file.update"
  | "file.delete"
  | "directory.create"
  | "none";

export type ComponentType =
  | "button"
  | "div"
  | "text"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "image"
  | "heading"
  | "paragraph"
  | "link"
  | "container"
  | "card"
  | "form"
  | "list"
  | "listItem"
  | "span"
  | "nav"
  | "header"
  | "footer"
  | "sidebar";

export interface ComponentProps {
  text?: string;
  className?: string;
  placeholder?: string;
  href?: string;
  src?: string;
  alt?: string;
  type?: string;
  name?: string;
  value?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface Component {
  id: string;
  type: ComponentType;
  props: ComponentProps;
  children: Component[];
}

export interface VoiceIntent {
  type: IntentType;
  target?: string;
  value?: string;
  pageName?: string;
  component?: {
    type?: ComponentType;
    props?: ComponentProps;
    children?: Component[];
  };
  metadata?: {
    confidence: number;
    originalText?: string;
    detectedLanguage?: string;
  };
}

export const VALID_INTENT_TYPES: IntentType[] = [
  "component.create",
  "component.update",
  "component.delete",
  "component.duplicate",
  "page.create",
  "page.delete",
  "nav.add",
  "ui.setColor",
  "ui.setTheme",
  "ui.setLayout",
  "nav.go",
  "file.create",
  "file.update",
  "file.delete",
  "directory.create",
  "none",
];

export const VALID_COMPONENT_TYPES: ComponentType[] = [
  "button",
  "div",
  "text",
  "input",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "image",
  "heading",
  "paragraph",
  "link",
  "container",
  "card",
  "form",
  "list",
  "listItem",
  "span",
  "nav",
  "header",
  "footer",
  "sidebar",
];

export const DEFAULT_PROPS: Record<ComponentType, ComponentProps> = {
  button: { className: "rounded-lg bg-blue-600 px-4 py-2 text-white" },
  div: { className: "p-4 bg-gray-100 rounded" },
  text: { className: "text-base" },
  input: { className: "border rounded px-3 py-2 w-full", placeholder: "Enter text..." },
  textarea: { className: "border rounded px-3 py-2 w-full", placeholder: "Enter text..." },
  select: { className: "border rounded px-3 py-2 w-full" },
  checkbox: { className: "w-4 h-4" },
  radio: { className: "w-4 h-4" },
  image: { className: "max-w-full h-auto" },
  heading: { className: "text-2xl font-bold", level: 1 },
  paragraph: { className: "text-base leading-relaxed" },
  link: { className: "text-blue-600 underline hover:text-blue-800", href: "#" },
  container: { className: "p-4 border rounded" },
  card: { className: "p-4 bg-white rounded-lg shadow" },
  form: { className: "space-y-4" },
  list: { className: "list-disc pl-5" },
  listItem: { className: "mb-1" },
  span: { className: "" },
  nav: { className: "flex items-center gap-4 p-4 bg-zinc-100" },
  header: { className: "p-4 bg-zinc-900 text-white" },
  footer: { className: "p-4 bg-zinc-900 text-white" },
  sidebar: { className: "w-64 p-4 bg-zinc-100 h-full" },
};

export const COMPONENT_ALIASES: Record<string, ComponentType> = {
  btn: "button",
  textbox: "input",
  textfield: "input",
  textinput: "input",
  field: "input",
  inputfield: "input",
  heading1: "heading",
  heading2: "heading",
  heading3: "heading",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  title: "heading",
  header: "heading",
  para: "paragraph",
  p: "paragraph",
  img: "image",
  picture: "image",
  photo: "image",
  box: "div",
  section: "div",
  wrapper: "div",
  area: "div",
  navigation: "nav",
  navbar: "nav",
};
