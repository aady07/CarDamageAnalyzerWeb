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
  | 'front_floor_1'
  | 'front_floor_2'
  | 'rear_floor_1'
  | 'rear_floor_2';

export interface CaptureSegment {
  id: CaptureSegmentId;
  label: string;
  instruction: string;
  timing: number;
  iconRotation?: number;
}

export type SegmentStatus = 'pending' | 'capturing' | 'verifying' | 'verified' | 'failed';


