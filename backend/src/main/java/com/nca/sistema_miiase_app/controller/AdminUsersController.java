package com.nca.sistema_miiase_app.controller;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.nca.sistema_miiase_app.service.auth.*;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUsersController {
    private final AdminUsersService users;
    private final AdminAuditService audit;
    public AdminUsersController(AdminUsersService users,AdminAuditService audit) { this.users=users; this.audit=audit; }
    public record Update(@NotBlank @Size(max=100) String firstName,@Size(max=100) String lastName,
        @NotBlank @Email @Size(max=320) String email,@NotNull Boolean enabled,Boolean confirmed) {}
    public record Roles(String profile,Set<String> roles,Boolean confirmed) {}
    public record Status(@NotNull Boolean enabled,Boolean confirmed) {}
    public record Erasure(String confirmation) {}
    @DeleteMapping("/orphans/{localId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eraseOrphan(@PathVariable int localId,@RequestBody Erasure value) {
        users.eraseOrphan(localId,value.confirmation());
    }
    @GetMapping public AdminUsersService.Page list(@RequestParam(defaultValue="0") int first,
        @RequestParam(defaultValue="20") int max,@RequestParam(defaultValue="") String search,
        @RequestParam(defaultValue="") String profile,@RequestParam(required=false) Boolean enabled,
        @RequestParam(defaultValue="false") boolean team) { return users.list(first,max,search,profile,enabled,team); }
    @GetMapping("/history") public List<Map<String,Object>> history(@RequestParam(defaultValue="") String target,
        @RequestParam(defaultValue="0") long before,@RequestParam(defaultValue="20") int max) {
        if (!target.isEmpty()) AdminUsersService.path(target);
        if (before<0 || max<1 || max>50) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Paginação inválida.");
        return audit.list(target,before,max);
    }
    @GetMapping("/{id}") public AdminUsersService.Details details(@PathVariable String id) { return users.details(id); }
    @PutMapping("/{id}") public AdminUsersService.UserView update(@PathVariable String id,@Valid @RequestBody Update value) {
        return users.change(id,null,Map.of("firstName",value.firstName(),"lastName",Objects.requireNonNullElse(value.lastName(),""),"email",value.email(),"enabled",value.enabled()),Boolean.TRUE.equals(value.confirmed()));
    }
    @PutMapping("/{id}/status") public AdminUsersService.UserView status(@PathVariable String id,@Valid @RequestBody Status value) {
        return users.change(id,null,Map.of("enabled",value.enabled()),Boolean.TRUE.equals(value.confirmed()));
    }
    @PutMapping("/{id}/roles") public AdminUsersService.UserView roles(@PathVariable String id,@RequestBody Roles value) {
        String profile=value.profile();
        // Compatibility with the existing client, constrained to business roles.
        if (value.roles()!=null) {
            if (profile!=null || value.roles().isEmpty() || !AdminUsersService.ROLES.containsAll(value.roles())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Selecione um perfil válido.");
            profile=value.roles().contains("ADMIN") ? "ADMIN" : value.roles().contains("CURATOR") ? "CURATOR" : "USER";
        }
        if (profile==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Selecione um perfil.");
        return users.change(id,profile,Map.of(),Boolean.TRUE.equals(value.confirmed()));
    }
}
