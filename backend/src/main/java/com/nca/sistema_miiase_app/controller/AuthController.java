package com.nca.sistema_miiase_app.controller;
import org.springframework.web.bind.annotation.*;
import com.nca.sistema_miiase_app.service.auth.AuthService;
import com.nca.sistema_miiase_app.service.auth.AccountLifecycleService;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.nca.sistema_miiase_app.dto.response.auth.LoginResponseDto;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final AccountLifecycleService lifecycle;
    public AuthController(AuthService auth, AccountLifecycleService lifecycle) { this.auth = auth; this.lifecycle = lifecycle; }
    @GetMapping("/me") public LoginResponseDto me() { return auth.currentUser(); }
    public record DeleteAccount(String confirmation) {}
    @DeleteMapping("/me") @ResponseStatus(HttpStatus.ACCEPTED)
    public void delete(@RequestBody DeleteAccount request) {
        if (!"EXCLUIR".equals(request.confirmation()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Confirme a exclusão permanente.");
        lifecycle.request(auth.identity().getSubject());
    }
}
