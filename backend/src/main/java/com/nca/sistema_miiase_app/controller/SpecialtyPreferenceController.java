package com.nca.sistema_miiase_app.controller;

import org.springframework.web.bind.annotation.*;
import com.nca.sistema_miiase_app.service.auth.AuthService;
import com.nca.sistema_miiase_app.service.curation.CurationFacetService.Selection;
import com.nca.sistema_miiase_app.service.curation.SpecialtyPreferenceService;

/** The logged-in curator's saved specialty filters ("Minhas áreas"); always the caller's own account. */
@RestController
@RequestMapping("/api/curation/especialidade")
public class SpecialtyPreferenceController {
    private final SpecialtyPreferenceService preferences;
    private final AuthService auth;

    public SpecialtyPreferenceController(SpecialtyPreferenceService preferences, AuthService auth) {
        this.preferences = preferences;
        this.auth = auth;
    }

    @GetMapping
    public Selection get() { return preferences.get(auth.currentId()); }

    @PutMapping
    public Selection save(@RequestBody Selection selection) { return preferences.save(auth.currentId(), selection); }
}
