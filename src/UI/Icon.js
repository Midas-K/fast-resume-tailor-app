import {
  ArrowLeft,
  Ban,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Eraser,
  Eye,
  FileDown,
  FileText,
  FolderOpen,
  GraduationCap,
  Info,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
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
  arrowLeft: ArrowLeft,
  ban: Ban,
  briefcase: Briefcase,
  building: Building2,
  check: Check,
  checkCircle: CheckCircle2,
  chevronRight: ChevronRight,
  copy: ClipboardCopy,
  clear: Eraser,
  eye: Eye,
  fileDown: FileDown,
  fileText: FileText,
  folder: FolderOpen,
  education: GraduationCap,
  info: Info,
  dashboard: LayoutDashboard,
  loader: Loader2,
  login: LogIn,
  logout: LogOut,
  mail: Mail,
  mapPin: MapPin,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  refresh: RefreshCw,
  save: Save,
  shield: Shield,
  sparkles: Sparkles,
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
