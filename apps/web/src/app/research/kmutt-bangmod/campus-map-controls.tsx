import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import styles from './viewer.module.css';

export type FollowAction = { enabled: boolean; onClick: () => void };

export function CampusMapControls({
  onZoom,
  followAction,
  following,
}: {
  onZoom: (direction: 1 | -1) => void;
  followAction?: FollowAction;
  following: boolean;
}) {
  return (
    <div className={styles.planFocus} aria-label="ควบคุมแผนที่" role="group">
      <Tooltip title="ซูมเข้า">
        <IconButton aria-label="ซูมเข้า" onClick={() => onZoom(1)}>
          <ShellIcon name="plus" />
        </IconButton>
      </Tooltip>
      <Tooltip title="ซูมออก">
        <IconButton aria-label="ซูมออก" onClick={() => onZoom(-1)}>
          <ShellIcon name="minus" />
        </IconButton>
      </Tooltip>
      {followAction && (
        <Tooltip title="ตามตำแหน่งฉัน">
          <span>
            <IconButton
              aria-label="ตามตำแหน่งฉัน"
              aria-pressed={following}
              disabled={!followAction.enabled}
              onClick={followAction.onClick}
            >
              <ShellIcon name="target" />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <span role="img" aria-label="ทิศเหนือ" className={styles.compass}>
        N
      </span>
    </div>
  );
}
