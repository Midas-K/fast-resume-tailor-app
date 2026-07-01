import {
  Archive,
  ArrowLeft,
  Ban,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CalendarX2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  ClipboardList,
  Eraser,
  Eye,
  FileDown,
  FileText,
  FileUp,
  FileX,
  FileCheck,
  FolderOpen,
  GraduationCap,
  Info,
  Layers,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react";

const ICONS = {
  archive: Archive,
  arrowLeft: ArrowLeft,
  ban: Ban,
  briefcase: Briefcase,
  building: Building2,
  calendarCheck: CalendarCheck,
  calendarDays: CalendarDays,
  calendarRange: CalendarRange,
  calendarX: CalendarX2,
  check: Check,
  checkCircle: CheckCircle2,
  chevronRight: ChevronRight,
  clipboardList: ClipboardList,
  copy: ClipboardCopy,
  clear: Eraser,
  eye: Eye,
  fileDown: FileDown,
  fileText: FileText,
  fileUp: FileUp,
  fileX: FileX,
  fileCheck: FileCheck,
  folder: FolderOpen,
  education: GraduationCap,
  info: Info,
  layers: Layers,
  dashboard: LayoutDashboard,
  loader: Loader2,
  login: LogIn,
  logout: LogOut,
  mail: Mail,
  mapPin: MapPin,
  menu: Menu,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  refresh: RefreshCw,
  save: Save,
  scrollText: ScrollText,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  trash: Trash2,
  upload: Upload,
  user: User,
  userCheck: UserCheck,
  userPlus: UserPlus,
  users: Users,
  wand: Wand2,
  close: X,
  zap: Zap,
};

function Icon({ name, size = 18, strokeWidth = 2, className = "" }) {
  const Component = ICONS[name];

  if (!Component) {
    return null;
  }

  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  );
}

export default Icon;
