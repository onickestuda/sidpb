package com.nca.sistema_miiase_app.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.nca.sistema_miiase_app.service.auth.AuthService;
import com.nca.sistema_miiase_app.service.curation.CurationFacetService.Selection;
import com.nca.sistema_miiase_app.service.curation.SpecialtyPreferenceService;

@org.springframework.context.annotation.Import(com.nca.sistema_miiase_app.config.SecurityConfig.class)
@WebMvcTest(SpecialtyPreferenceController.class)
class SpecialtyPreferenceControllerTest {
    @MockitoBean JwtDecoder jwtDecoder;
    @MockitoBean SpecialtyPreferenceService preferences;
    @MockitoBean AuthService auth;
    @Autowired org.springframework.web.context.WebApplicationContext context;
    MockMvc mvc;

    @org.junit.jupiter.api.BeforeEach void setup() {
        mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup(context)
                .apply(org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity()).build();
    }

    @Test @WithMockUser(roles = {"USER", "CURATOR"})
    void devolveAEspecialidadeDaPropriaConta() throws Exception {
        when(auth.currentId()).thenReturn(7);
        when(preferences.get(7)).thenReturn(new Selection(List.of("Miíase"), List.of(), List.of(), List.of("MA")));
        mvc.perform(get("/api/curation/especialidade"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diseases[0]").value("Miíase"))
                .andExpect(jsonPath("$.states[0]").value("MA"))
                .andExpect(jsonPath("$.empty").doesNotExist());
    }

    @Test @WithMockUser(roles = {"USER", "CURATOR"})
    void salvaNaContaDoUsuarioLogado() throws Exception {
        when(auth.currentId()).thenReturn(7);
        when(preferences.save(eq(7), any())).thenAnswer(call -> call.getArgument(1));
        mvc.perform(put("/api/curation/especialidade").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"diseases\":[\"Miíase\"],\"vectors\":[],\"hosts\":[\"boi\"],\"states\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hosts[0]").value("boi"));
        verify(preferences).save(eq(7), argThat(selection -> selection.diseases().equals(List.of("Miíase"))));
    }

    @Test @WithMockUser(roles = "USER")
    void usuarioSemCuradoriaNaoAcessa() throws Exception {
        mvc.perform(get("/api/curation/especialidade")).andExpect(status().isForbidden());
        verifyNoInteractions(preferences);
    }
}
