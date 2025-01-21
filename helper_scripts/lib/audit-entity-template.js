"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = void 0;
function render(className, auditClassName, importPath) {
    return `import { ${className} } from '${importPath}';
import { AuditingAction, AuditingEntity, AuditingEntityDefaultColumns } from 'typeorm-auditing';

@AuditingEntity(${className}, { name: "${className === null || className === void 0 ? void 0 : className.toLowerCase()}_audit" })
export class ${auditClassName} extends ${className} implements AuditingEntityDefaultColumns {
  \treadonly _seq: number;
  \treadonly _action: AuditingAction;
  \treadonly _modifiedAt: Date;
} `;
}
exports.render = render;
//# sourceMappingURL=audit-entity-template.js.map