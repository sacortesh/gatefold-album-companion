interface StubProps {
  title: string;
  phase: string;
}

function Stub({ title, phase }: StubProps) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-neutral-400">
        Placeholder — built in {phase}.
      </p>
    </section>
  );
}

export const BacklogPage = () => <Stub title="Backlog" phase="Phase 4" />;
export const AlbumPage = () => <Stub title="Album" phase="Phase 5" />;
export const RevisitPage = () => <Stub title="Revisit" phase="Phase 6" />;

export const NotFoundPage = () => (
  <section className="space-y-2">
    <h1 className="text-2xl font-semibold">Not found</h1>
    <p className="text-sm text-neutral-400">No page at this address.</p>
  </section>
);
