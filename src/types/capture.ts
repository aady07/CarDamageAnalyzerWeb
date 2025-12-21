export type CaptureSegmentId =
  | 'front'
  | 'rear'
  | 'right_front_fender'
  | 'right_front_door'
  | 'right_rear_door'
  | 'right_rear_fender'
  | 'left_front_fender'
  | 'left_front_door'
  | 'left_rear_door'
  | 'left_rear_fender'
  | 'front_floor'
  | 'tissue'
  | 'rear_floor'
  | 'bottle';

export interface CaptureSegment {
  id: CaptureSegmentId;
  label: string;
  instruction: string;
  timing: number;
  iconRotation?: number;
}

export type SegmentStatus = 'pending' | 'capturing' | 'verifying' | 'verified' | 'failed';


