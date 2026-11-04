import { appName } from '@/config/public';
import Typography from '@mui/material/Typography';

export default function Home() {
  return (
    <main>
      <Typography component="p" lang="en" className="text-body">
        {appName}: foundation is running.
      </Typography>
    </main>
  );
}
