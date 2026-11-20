import PageSkeleton from "@/components/layout/PageSkeleton";

export default function Loading() {
  return <PageSkeleton variant="service" crumbs={[{ label: "My Services", href: "/" }, { label: "Loading…" }]} />;
}
