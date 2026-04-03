import AdminWorkspace from '@/components/admin/AdminWorkspace.vue'
import AnnotationWorkspace from '@/components/annotation/AnnotationWorkspace.vue'
import DetailsWorkspace from '@/components/details/DetailsWorkspace.vue'
import RecognitionWorkspace from '@/components/recognition/RecognitionWorkspace.vue'

export const WORKSPACE_COMPONENTS = {
  recognition: RecognitionWorkspace,
  annotation: AnnotationWorkspace,
  details: DetailsWorkspace,
  admin: AdminWorkspace,
}

export function getWorkspaceComponent(workspaceId) {
  return WORKSPACE_COMPONENTS[workspaceId] || null
}
