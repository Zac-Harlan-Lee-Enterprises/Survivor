import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="card mx-auto my-16 max-w-md p-8 text-center">
      <p className="eyebrow">Fourth and long</p>
      <h1 className="mt-2 text-4xl font-extrabold text-ink-50">Page not found</h1>
      <p className="mt-2 text-ink-300">That route ran out of bounds.</p>
      <Button className="mt-6" asChild>
        <Link to="/">Back to the league</Link>
      </Button>
    </div>
  )
}
