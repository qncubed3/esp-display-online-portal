import PageSkeleton from "@/components/layout/PageSkeleton";

export default function Loading() {
  return <PageSkeleton variant="service" crumbs={[{ label: "Services", href: "/" }, { label: "Loading…" }]} />;
}
