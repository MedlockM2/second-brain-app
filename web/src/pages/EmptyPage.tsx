/**
 * A destination of the bar, empty until its screen task fills it (task-476 to
 * task-484). It only names itself, so the route can be checked by hand.
 */
export function EmptyPage({ title }: { title?: string }) {
  return <main className="page">{title && <h1 className="display">{title}</h1>}</main>;
}
