import PageSkeleton from "@/components/layout/PageSkeleton";

export default function Loading() {
  return <PageSkeleton variant="cards" crumbs={[{ label: "Shared with me" }]} />;
}
