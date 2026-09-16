import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
  FormControlLabel, List, ListItem, ListItemIcon, ListItemText, MenuItem,
  Stack, Switch, TextField, Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { navByRole } from "../App";
import type { NavItem } from "./AppLayout";
import { useTranslation } from "react-i18next";
import type { Role } from "../auth/AuthContext";
import {
  BACKOFFICE_PAGE_CONTAINER_SECTIONS,
  SIDEBAR_GROUP_CONTAINERS,
  SIDEBAR_VISIBILITY_SECTIONS,
  pageContainerKey,
  sidebarGroupKey,
  sidebarItemKey,
  type SidebarVisibilityItem,
  type SidebarVisibilitySection
} from "../config/sidebarVisibility";
import type { PackageCode } from "../auth/PackagesContext";

interface SidebarVisibilityResponse {
  hiddenItems: string[];
}

interface TenantPackagesResponse {
  packages: PackageCode[];
}

interface OfficeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
}

interface UserPermissionsResponse {
  effective: string[];
}

const OFFICE_SIDEBAR_ROLES: Role[] = ["AgencyAdmin", "AgencyUser", "Producer", "Customer"];

function SidebarPreview({
  user, activePackages, hiddenItems, permissions
}: {
  user: OfficeUser;
  activePackages: Set<PackageCode>;
  hiddenItems: Set<string>;
  permissions: Set<string>;
}) {
  const { t } = useTranslation();
  const bypassPermissions = user.role === "AgencyAdmin";
  const navItems = useMemo(() => {
    const source = navByRole[user.role] ?? [];
    return source.filter((item) => {
      if (hiddenItems.has(sidebarItemKey(item.to))) return false;
      if (item.group && hiddenItems.has(sidebarGroupKey(item.group))) return false;
      if (item.package && !activePackages.has(item.package)) return false;
      if (item.permission && !bypassPermissions && !permissions.has(item.permission)) return false;
      return true;
    }).filter((item, index, all) => {
      const key = `${item.to}\u0000${item.group ?? ""}`;
      return all.findIndex((other) => `${other.to}\u0000${other.group ?? ""}` === key) === index;
    });
  }, [activePackages, bypassPermissions, hiddenItems, permissions, user.role]);

  const dashboard = navItems.find((item) => item.to === "/" && !item.group);
  const topLevel = navItems.filter((item) => !item.group && item.to !== "/");
  const groups = useMemo(() => {
    const result: { key: string; icon?: ReactNode; items: NavItem[] }[] = [];
    for (const item of navItems) {
      if (!item.group) continue;
      let group = result.find((entry) => entry.key === item.group);
      if (!group) {
        group = { key: item.group, icon: item.groupIcon, items: [] };
        result.push(group);
      }
      if (item.groupIcon && !group.icon) group.icon = item.groupIcon;
      group.items.push(item);
    }
    return result;
  }, [navItems]);

  const Item = ({ item, indented = false }: { item: NavItem; indented?: boolean }) => (
    <ListItem disableGutters sx={{ px: indented ? 1.8 : 1.2, py: 0.18, minHeight: 31 }}>
      <ListItemIcon sx={{ minWidth: 30, color: "text.secondary", "& > svg": { fontSize: 18 } }}>
        {item.icon}
      </ListItemIcon>
      <ListItemText
        primary={t(item.labelKey)}
        primaryTypographyProps={{ fontSize: 12.5, fontWeight: indented ? 500 : 600, noWrap: true }}
      />
    </ListItem>
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 360, border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", boxShadow: "0 8px 22px rgba(11,37,69,0.10)" }}>
      <Box sx={{ px: 1.5, py: 1.1, bgcolor: "#0b2545", color: "common.white" }}>
        <Typography fontSize={13} fontWeight={800} noWrap>Kalypsis</Typography>
      </Box>
      <List dense disablePadding sx={{ px: 0.45, py: 0.6, maxHeight: 520, overflowY: "auto" }}>
        {dashboard && <Item item={dashboard} />}
        {dashboard && (topLevel.length > 0 || groups.length > 0) && <Divider sx={{ my: 0.5 }} />}
        {topLevel.map((item) => <Item key={`${item.to}-${item.labelKey}`} item={item} />)}
        {groups.length > 0 && topLevel.length > 0 && <Divider sx={{ my: 0.5 }} />}
        {groups.map((group) => (
          <Box key={group.key} sx={{ mb: 0.45 }}>
            <ListItem disableGutters sx={{ px: 1.2, py: 0.4, minHeight: 32, bgcolor: "rgba(11,37,69,0.045)", borderRadius: 1 }}>
              <ListItemIcon sx={{ minWidth: 30, color: "text.secondary", "& > svg": { fontSize: 18 } }}>
                {group.icon ?? <FolderIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={t(`nav.group.${group.key}`, group.key)}
                primaryTypographyProps={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", noWrap: true }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>{group.items.length}</Typography>
              <ExpandMoreIcon fontSize="small" color="action" />
            </ListItem>
            {group.items.map((item) => <Item key={`${item.to}-${item.labelKey}`} item={item} indented />)}
          </Box>
        ))}
        {navItems.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            Δεν υπάρχουν ορατές επιλογές.
          </Typography>
        )}
      </List>
      <Divider />
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="caption" fontWeight={700} noWrap display="block">
          {user.firstName} {user.lastName}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {t(`roles.${user.role}`)}
        </Typography>
      </Box>
    </Box>
  );
}

function VisibilitySwitch({
  item, hidden, onChange, disabled = false
}: {
  item: Pick<SidebarVisibilityItem, "label" | "detail">;
  hidden: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <FormControlLabel
      sx={{ m: 0, py: 0.5, alignItems: "flex-start", width: "100%" }}
      labelPlacement="start"
      control={<Switch checked={!hidden} onChange={(_, checked) => onChange(!checked)} disabled={disabled} />}
      label={
        <Box sx={{ pr: 2 }}>
          <Typography fontWeight={600}>{item.label}</Typography>
          {item.detail && <Typography variant="body2" color="text.secondary">{item.detail}</Typography>}
        </Box>
      }
      componentsProps={{ typography: { sx: { flex: 1 } } }}
    />
  );
}

/**
 * The editable version of the office navigation. It deliberately follows the
 * sidebar's order and group containers instead of presenting a catalogue of
 * cards, so an administrator can immediately see what each switch affects.
 */
function SidebarVisibilityEditor({
  sections, groupContainers, hiddenItems, onChange
}: {
  sections: SidebarVisibilitySection[];
  groupContainers: Map<string, SidebarVisibilityItem>;
  hiddenItems: Set<string>;
  onChange: (key: string, hidden: boolean) => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" fontWeight={700}>Ρύθμιση δομής sidebar</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
          Η ίδια σειρά και τα ίδια containers με το sidebar του γραφείου. Κλείστε μια γραμμή για να κρυφτεί μόνο αυτή,
          ή κλείστε τον διακόπτη της κατηγορίας για να κρυφτεί ολόκληρο το πλαίσιο.
        </Typography>
        <Box sx={{ width: "100%", maxWidth: 540, border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", boxShadow: "0 8px 22px rgba(11,37,69,0.08)" }}>
          <Box sx={{ px: 1.5, py: 1.1, bgcolor: "#0b2545", color: "common.white" }}>
            <Typography fontSize={13} fontWeight={800}>Sidebar γραφείου</Typography>
          </Box>
          <List dense disablePadding sx={{ px: 0.75, py: 0.75, maxHeight: 720, overflowY: "auto" }}>
            {sections.map((section, sectionIndex) => {
              const group = section.groupKey ? groupContainers.get(section.groupKey) : undefined;
              const groupHidden = !!section.groupKey && hiddenItems.has(sidebarGroupKey(section.groupKey));
              return (
                <Box key={section.title} sx={{ mb: 0.5 }}>
                  {sectionIndex > 0 && <Divider sx={{ my: 0.75 }} />}
                  {group ? (
                    <ListItem disableGutters sx={{ px: 1.1, py: 0.4, minHeight: 38, bgcolor: "rgba(11,37,69,0.055)", borderRadius: 1 }}>
                      <ListItemIcon sx={{ minWidth: 30, color: "text.secondary" }}><FolderIcon fontSize="small" /></ListItemIcon>
                      <ListItemText
                        primary={group.label}
                        secondary="Ολόκληρη κατηγορία"
                        primaryTypographyProps={{ fontSize: 12.5, fontWeight: 800, noWrap: true }}
                        secondaryTypographyProps={{ fontSize: 10.5, noWrap: true }}
                      />
                      <Switch
                        size="small"
                        checked={!groupHidden}
                        inputProps={{ "aria-label": `Εμφάνιση κατηγορίας ${group.label}` }}
                        onChange={(_, checked) => onChange(sidebarGroupKey(section.groupKey!), !checked)}
                      />
                    </ListItem>
                  ) : (
                    <Typography variant="overline" color="text.secondary" sx={{ display: "block", px: 1.1, pb: 0.25, fontWeight: 800, letterSpacing: "0.06em" }}>
                      {section.title}
                    </Typography>
                  )}
                  {section.items.map((item) => {
                    const itemHidden = hiddenItems.has(sidebarItemKey(item.path));
                    return (
                      <ListItem
                        key={item.path}
                        disableGutters
                        sx={{ px: group ? 1.8 : 1.1, py: 0.15, minHeight: 36, opacity: groupHidden ? 0.5 : 1 }}
                      >
                        <ListItemIcon sx={{ minWidth: group ? 26 : 30, color: "text.secondary" }}>
                          {group ? <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "currentColor" }} /> : <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "currentColor" }} />}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          secondary={item.detail}
                          primaryTypographyProps={{ fontSize: 13, fontWeight: 600, noWrap: true }}
                          secondaryTypographyProps={{ fontSize: 10.5, noWrap: true }}
                        />
                        <Switch
                          size="small"
                          checked={!itemHidden}
                          inputProps={{ "aria-label": `Εμφάνιση ${item.label}` }}
                          onChange={(_, checked) => onChange(sidebarItemKey(item.path), !checked)}
                        />
                      </ListItem>
                    );
                  })}
                </Box>
              );
            })}
          </List>
        </Box>
      </CardContent>
    </Card>
  );
}

export function TenantSidebarVisibilityTab({ tenantId, onError }: {
  tenantId: string;
  onError: (message: string | null) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [previewUserId, setPreviewUserId] = useState("");
  const query = useQuery({
    queryKey: ["tenant-sidebar-visibility", tenantId],
    queryFn: async () => (await api.get<SidebarVisibilityResponse>(
      `/platform/tenants/${tenantId}/sidebar-visibility`
    )).data
  });
  const packagesQuery = useQuery({
    queryKey: ["tenant-packages", tenantId],
    queryFn: async () => (await api.get<TenantPackagesResponse>(
      `/platform/tenants/${tenantId}/packages`
    )).data
  });
  const usersQuery = useQuery({
    queryKey: ["tenant-sidebar-preview-users", tenantId],
    queryFn: async () => (await api.get<OfficeUser[]>("/platform/users", { params: { tenantId } })).data
  });

  const saved = useMemo(() => new Set(query.data?.hiddenItems ?? []), [query.data]);
  const current = draft ?? saved;
  const changed = draft !== null;
  const activePackages = useMemo(
    () => new Set(packagesQuery.data?.packages ?? []),
    [packagesQuery.data]
  );
  const belongsToActivePackage = (item: { packages?: readonly PackageCode[] }) =>
    !item.packages || item.packages.some((pkg) => activePackages.has(pkg));
  const availableGroupContainers = new Map(
    SIDEBAR_GROUP_CONTAINERS
      .filter(belongsToActivePackage)
      .map((item) => [item.path, item])
  );
  const availableSections = SIDEBAR_VISIBILITY_SECTIONS
    .filter(belongsToActivePackage)
    .map((section) => ({
      ...section,
      items: section.items.filter(belongsToActivePackage)
    }))
    .filter((section) => section.items.length > 0);
  const availablePageContainerSections = BACKOFFICE_PAGE_CONTAINER_SECTIONS
    .filter(belongsToActivePackage)
    .map((section) => ({
      ...section,
      items: section.items.filter(belongsToActivePackage)
    }))
    .filter((section) => section.items.length > 0);
  const previewUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => user.isActive && OFFICE_SIDEBAR_ROLES.includes(user.role)),
    [usersQuery.data]
  );
  useEffect(() => {
    if (previewUsers.length === 0) return;
    if (!previewUsers.some((user) => user.id === previewUserId)) {
      setPreviewUserId(previewUsers[0].id);
    }
  }, [previewUserId, previewUsers]);
  const previewUser = previewUsers.find((user) => user.id === previewUserId) ?? null;
  const previewPermissionsQuery = useQuery({
    queryKey: ["tenant-sidebar-preview-permissions", previewUser?.id],
    enabled: !!previewUser,
    queryFn: async () => (await api.get<UserPermissionsResponse>(`/permissions/user/${previewUser!.id}`)).data
  });

  const update = (key: string, hidden: boolean) => {
    setDraft(previous => {
      const next = new Set(previous ?? saved);
      if (hidden) next.add(key); else next.delete(key);
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => (await api.put<SidebarVisibilityResponse>(
      `/platform/tenants/${tenantId}/sidebar-visibility`,
      { hiddenItems: [...current] }
    )).data,
    onSuccess: (data) => {
      qc.setQueryData(["tenant-sidebar-visibility", tenantId], data);
      setDraft(null);
      onError(null);
    },
    onError: (error) => onError(extractErrorMessage(error))
  });

  if (query.isLoading || packagesQuery.isLoading || usersQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (query.error || packagesQuery.error || usersQuery.error) {
    return <Alert severity="error">Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων sidebar, των ενεργών πακέτων ή των χρηστών του γραφείου.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Οι ρυθμίσεις αυτές αφορούν μόνο την εμφάνιση του sidebar για αυτό το γραφείο. Δεν αφαιρούν δικαιώματα,
        πακέτα ή πρόσβαση με απευθείας σύνδεσμο. Εμφανίζονται μόνο επιλογές από τα ενεργά πακέτα του γραφείου.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems={{ md: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700}>Προεπισκόπηση sidebar χρήστη</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Δείτε τη navigation που θα έχει ο συγκεκριμένος χρήστης, με βάση τον ρόλο, τα ενεργά πακέτα,
                τα δικαιώματά του και τις παραπάνω επιλογές του γραφείου. Η προεπισκόπηση ενημερώνεται αμέσως,
                χωρίς είσοδο ή impersonation ως χρήστης.
              </Typography>
              {previewUsers.length > 0 ? (
                <TextField
                  select
                  fullWidth
                  label="Χρήστης για προεπισκόπηση"
                  value={previewUserId}
                  onChange={(event) => setPreviewUserId(event.target.value)}
                  sx={{ maxWidth: 480 }}
                >
                  {previewUsers.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} — {user.email}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Alert severity="warning">Δεν υπάρχει ενεργός χρήστης αυτού του γραφείου για προεπισκόπηση.</Alert>
              )}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                Οι κατηγορίες εμφανίζονται ανοιχτές μόνο στην προεπισκόπηση, ώστε να ελέγχετε όλα τα στοιχεία.
                Το αν είναι ανοιχτές ή κλειστές στο πραγματικό sidebar παραμένει προσωπική επιλογή του χρήστη στη συσκευή του.
              </Typography>
            </Box>
            {previewUser && (
              previewPermissionsQuery.error ? (
                <Alert severity="error" sx={{ width: 360 }}>
                  Δεν ήταν δυνατός ο υπολογισμός των δικαιωμάτων του επιλεγμένου χρήστη.
                </Alert>
              ) : previewPermissionsQuery.isLoading ? (
                <Box sx={{ width: 360, minHeight: 220, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>
              ) : (
                <SidebarPreview
                  user={previewUser}
                  activePackages={activePackages}
                  hiddenItems={current}
                  permissions={new Set(previewPermissionsQuery.data?.effective ?? [])}
                />
              )
            )}
          </Stack>
        </CardContent>
      </Card>

      <SidebarVisibilityEditor
        sections={availableSections}
        groupContainers={availableGroupContainers}
        hiddenItems={current}
        onChange={update}
      />

      {availablePageContainerSections.map((section) => (
        <Card key={section.title} variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={700}>{section.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{section.description}</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, columnGap: 4 }}>
              {section.items.map((item) => (
                <VisibilitySwitch
                  key={`${item.pageId}/${item.containerId}`}
                  item={item}
                  hidden={current.has(pageContainerKey(item.pageId, item.containerId))}
                  onChange={(hidden) => update(pageContainerKey(item.pageId, item.containerId), hidden)}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      ))}

      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        {changed && <Button onClick={() => setDraft(null)}>Ακύρωση</Button>}
        <Button variant="outlined" disabled={save.isPending || current.size === 0}
          onClick={() => setDraft(new Set())}>
          Επαναφορά όλων
        </Button>
        <Button variant="contained" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Αποθήκευση…" : "Αποθήκευση"}
        </Button>
      </Stack>
    </Stack>
  );
}
